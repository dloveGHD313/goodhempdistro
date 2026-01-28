import { NextRequest, NextResponse } from "next/server";
import { classifyIntent } from "@/server/mascot/intents";
import { checkSafety } from "@/server/mascot/safety";
import { quickRepliesByContext, type MascotContext, type MascotMood } from "@/components/mascot/config";
import { searchFeedPosts } from "@/server/mascot/tools/searchFeedPosts";
import { searchProducts } from "@/server/mascot/tools/searchProducts";
import { searchEvents } from "@/server/mascot/tools/searchEvents";
import { getVendorHelp } from "@/server/mascot/tools/getVendorHelp";
import { getDriverDeliveries } from "@/server/mascot/tools/getDriverDeliveries";
import { getLogisticsLoads } from "@/server/mascot/tools/getLogisticsLoads";
import { getOrderDetails } from "@/server/mascot/tools/getOrderDetails";
import { logMascotFlagMismatch } from "@/lib/mascotFlags";
import { setMascotLastError } from "@/lib/mascotDiagnostics";

type MascotMessage = { role: "user" | "assistant"; content: string };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const uuidRegex =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

const normalizeProductQuery = (text: string) =>
  text
    .replace(/find products?/gi, "")
    .replace(/under \$?\d+/gi, "")
    .replace(/top vendors?/gi, "")
    .replace(/what'?s a coa\??/gi, "")
    .trim();

const response = (payload: {
  reply: string;
  mood: MascotMood;
  results: {
    type: string;
    items: Array<{
      title: string;
      subtitle?: string | null;
      href?: string | null;
      meta?: string | null;
      imageUrl?: string | null;
    }>;
  };
  suggestions: string[];
}) => NextResponse.json(payload);

const unavailableResponse = (message: string, suggestions: string[] = []) =>
  response({
    reply: message,
    mood: "BLOCKED",
    results: { type: "none", items: [] },
    suggestions,
  });

const buildSystemPrompt = (params: {
  contextMode: MascotContext;
  route: string;
  intent: string;
  baseReply: string;
  results: { type: string; items: Array<{ title: string; subtitle?: string | null }> };
  suggestions: string[];
}) => {
  return [
    "You are the Good Hemp Distros mascot assistant.",
    "Stay concise, friendly, and action-oriented.",
    "Never claim to complete purchases or account changes; only guide and link.",
    "If you are unsure, ask a short clarifying question.",
    `Context: ${params.contextMode}`,
    `Route: ${params.route}`,
    `Intent: ${params.intent}`,
    `Base reply: ${params.baseReply}`,
    `Results: ${JSON.stringify(params.results)}`,
    `Quick replies: ${params.suggestions.join(" | ")}`,
  ].join("\n");
};

const isTransientStatus = (status?: number) =>
  status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

const timeoutMs = 12000;

const openaiChat = async (params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: MascotMessage[];
}) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: params.model,
          temperature: 0.4,
          messages: [
            { role: "system", content: params.systemPrompt },
            ...params.messages.slice(-6),
          ],
        }),
      });

      if (!response.ok) {
        if (attempt === 0 && isTransientStatus(response.status)) {
          continue;
        }
        return {
          ok: false as const,
          status: response.status,
          errorName: "OpenAIResponseError",
          errorMessage: `OpenAI status ${response.status}`,
        };
      }

      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        if (attempt === 0) {
          continue;
        }
        return {
          ok: false as const,
          status: response.status,
          errorName: "OpenAIEmptyReply",
          errorMessage: "OpenAI returned no reply",
        };
      }

      return { ok: true as const, status: response.status, reply };
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "UnknownError";
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (attempt === 0) {
        continue;
      }
      return {
        ok: false as const,
        status: undefined,
        errorName,
        errorMessage,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    ok: false as const,
    status: undefined,
    errorName: "OpenAIUnknown",
    errorMessage: "OpenAI request failed",
  };
};

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const flagStatus = logMascotFlagMismatch("api/mascot-chat");
  const aiEnabled = flagStatus.serverEnabled;
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const hasOpenAIKey = Boolean(openaiKey);
  const fallbackSuggestions = quickRepliesByContext.GENERIC || [];

  if (!aiEnabled) {
    console.info(
      `[mascot-chat] requestId=${requestId} status=200 flags:client=${flagStatus.clientEnabled} server=${flagStatus.serverEnabled} key=${hasOpenAIKey}`
    );
    return response({
      reply: "Mascot AI is offline right now.",
      mood: "BLOCKED",
      results: { type: "none", items: [] },
      suggestions: [],
    });
  }

  if (!hasOpenAIKey) {
    setMascotLastError({
      name: "MissingOpenAIKey",
      message: "OPENAI_API_KEY is not set",
      at: new Date().toISOString(),
    });
    console.info(
      `[mascot-chat] requestId=${requestId} status=200 flags:client=${flagStatus.clientEnabled} server=${flagStatus.serverEnabled} key=${hasOpenAIKey}`
    );
    return unavailableResponse("AI is temporarily unavailable. Please try again soon.", fallbackSuggestions);
  }

  try {
    const body = await req.json();
    const messages = (body?.messages || []) as MascotMessage[];
    const contextMode = (body?.contextMode || "GENERIC") as MascotContext;
    const route = (body?.route || "/") as string;

    const lastUser = [...messages].reverse().find((message) => message.role === "user");
    if (!lastUser?.content) {
      console.info(
        `[mascot-chat] requestId=${requestId} status=200 flags:client=${flagStatus.clientEnabled} server=${flagStatus.serverEnabled} key=${hasOpenAIKey}`
      );
      return response({
        reply: "Tell me what you're looking for and I'll pull real results.",
        mood: "CHILL",
        results: { type: "none", items: [] },
        suggestions: quickRepliesByContext[contextMode] || [],
      });
    }

    const safety = checkSafety(lastUser.content);
    if (safety) {
      console.info(
        `[mascot-chat] requestId=${requestId} status=200 flags:client=${flagStatus.clientEnabled} server=${flagStatus.serverEnabled} key=${hasOpenAIKey}`
      );
      return response({
        reply: safety.reply,
        mood: safety.mood,
        results: { type: "none", items: [] },
        suggestions: safety.suggestions,
      });
    }

    const intent = classifyIntent(lastUser.content, contextMode);
    const normalized = lastUser.content.toLowerCase();
    const suggestions = quickRepliesByContext[contextMode] || [];

    let basePayload: {
      reply: string;
      mood: MascotMood;
      results: { type: string; items: Array<{ title: string; subtitle?: string | null }> };
      suggestions: string[];
    };

    if (intent === "product_search") {
      const maxPrice = normalized.includes("under $50") ? 5000 : undefined;
      const query = normalizeProductQuery(lastUser.content);
      const items = await searchProducts(query, { maxPriceCents: maxPrice, limit: 6 });
      basePayload = {
        reply: items.length
          ? "Here are verified products matching your search."
          : "No verified products matched that yet. Try another keyword or filter.",
        mood: items.length ? "SUCCESS" : "FOCUSED",
        results: { type: "products", items },
        suggestions,
      };
    } else if (intent === "event_search") {
      const items = await searchEvents(lastUser.content, { limit: 6 });
      basePayload = {
        reply: items.length
          ? "Here are upcoming events that match."
          : "No upcoming events matched that. Try a different search.",
        mood: items.length ? "SUCCESS" : "FOCUSED",
        results: { type: "events", items },
        suggestions,
      };
    } else if (intent === "feed_search") {
      const items = await searchFeedPosts();
      basePayload = {
        reply: items.length
          ? "Here are verified feed posts."
          : "I don't see verified posts matching that yet. Try products or events.",
        mood: items.length ? "SUCCESS" : "FOCUSED",
        results: { type: "posts", items },
        suggestions,
      };
    } else if (intent === "vendor_help") {
      const results = getVendorHelp(lastUser.content);
      basePayload = {
        reply: "Here's the fastest path for vendors.",
        mood: "EDUCATIONAL",
        results,
        suggestions,
      };
    } else if (intent === "driver_deliveries") {
      const items = await getDriverDeliveries();
      basePayload = {
        reply: items.length
          ? "Here are your latest deliveries."
          : "No deliveries found yet for your driver profile.",
        mood: items.length ? "SUCCESS" : "FOCUSED",
        results: { type: "deliveries", items },
        suggestions,
      };
    } else if (intent === "logistics_loads") {
      const items = await getLogisticsLoads();
      basePayload = {
        reply: items.length
          ? "Here are your assigned loads."
          : "No verified loads are available yet for your logistics profile.",
        mood: items.length ? "SUCCESS" : "FOCUSED",
        results: { type: "loads", items },
        suggestions,
      };
    } else if (intent === "order_lookup") {
      const match = lastUser.content.match(uuidRegex);
      const orderId = match ? match[0] : "";
      const items = await getOrderDetails(orderId);
      basePayload = {
        reply: items.length
          ? "Here's the order I found."
          : "I couldn't find that order. Double-check the ID or check your account.",
        mood: items.length ? "SUCCESS" : "FOCUSED",
        results: { type: "links", items },
        suggestions,
      };
    } else {
      basePayload = {
        reply: "Tell me what you want to do and I'll point you to the right place.",
        mood: "CHILL",
        results: { type: "none", items: [] },
        suggestions,
      };
    }

    const openaiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
    const openaiSearchModel =
      process.env.OPENAI_SEARCH_MODEL?.trim() || "gpt-4o-mini-search-preview";
    const model =
      intent === "product_search" || intent === "event_search" || intent === "feed_search"
        ? openaiSearchModel
        : openaiModel;

    const systemPrompt = buildSystemPrompt({
      contextMode,
      route,
      intent,
      baseReply: basePayload.reply,
      results: basePayload.results,
      suggestions: basePayload.suggestions,
    });

    const openaiResult = await openaiChat({
      apiKey: openaiKey as string,
      model,
      systemPrompt,
      messages,
    });

    if (!openaiResult.ok) {
      setMascotLastError({
        name: openaiResult.errorName,
        message: openaiResult.errorMessage,
        status: openaiResult.status,
        at: new Date().toISOString(),
      });
      console.warn(
        `[mascot-chat] requestId=${requestId} status=200 openaiStatus=${openaiResult.status ?? "n/a"} error=${openaiResult.errorName} flags:client=${flagStatus.clientEnabled} server=${flagStatus.serverEnabled} key=${hasOpenAIKey}`
      );
      return unavailableResponse(
        "AI is temporarily unavailable. Please try again soon.",
        basePayload.suggestions
      );
    }

    setMascotLastError(null);
    console.info(
      `[mascot-chat] requestId=${requestId} status=200 flags:client=${flagStatus.clientEnabled} server=${flagStatus.serverEnabled} key=${hasOpenAIKey}`
    );

    return response({
      ...basePayload,
      reply: openaiResult.reply,
    });
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    setMascotLastError({
      name: errorName,
      message: errorMessage,
      at: new Date().toISOString(),
    });
    console.error("[mascot-chat] error", error);
    console.info(
      `[mascot-chat] requestId=${requestId} status=500 flags:client=${flagStatus.clientEnabled} server=${flagStatus.serverEnabled} key=${hasOpenAIKey}`
    );
    return response({
      reply: "AI is temporarily unavailable. Please try again soon.",
      mood: "ERROR",
      results: { type: "none", items: [] },
      suggestions: [],
    });
  }
}
