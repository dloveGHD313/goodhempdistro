import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getJaxEligibility } from "@/lib/jax/eligibility";
import {
  getGlobalDailyCount,
  getUserMonthlyCount,
  incrementGlobalDaily,
  incrementUserMonthly,
  JAX_USAGE_HELPERS,
} from "@/lib/jax/usage";
import { extractInterestsFromAnswers } from "@/lib/onboarding/interests";
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

type BasePayload = {
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
};

const response = (payload: BasePayload) => NextResponse.json(payload);

const unavailableResponse = (message: string, suggestions: string[] = []) =>
  response({
    reply: message,
    mood: "BLOCKED",
    results: { type: "none", items: [] },
    suggestions,
  });

type UserContext = {
  name: string;
  roles: string[];
  location: string;
  topInterests: string[];
};

const buildSystemPrompt = (params: {
  contextMode: MascotContext;
  route: string;
  intent: string;
  baseReply: string;
  results: BasePayload["results"];
  suggestions: string[];
  userContext: UserContext | null;
}) => {
  const lines = [
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
  ];

  if (params.userContext) {
    const u = params.userContext;
    lines.push(
      "",
      "USER CONTEXT (use naturally, don't list back robotically):",
      `Name: ${u.name}`,
      `Roles: ${u.roles.length ? u.roles.join(", ") : "consumer"}`,
      `Location: ${u.location || "unknown"}`,
      `Top interests: ${u.topInterests.length ? u.topInterests.join(", ") : "general"}`
    );
  }

  return lines.join("\n");
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
      const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
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

      if (!upstream.ok) {
        if (attempt === 0 && isTransientStatus(upstream.status)) {
          continue;
        }
        return {
          ok: false as const,
          status: upstream.status,
          errorName: "OpenAIResponseError",
          errorMessage: `OpenAI status ${upstream.status}`,
        };
      }

      const data = await upstream.json();
      const reply = data?.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        if (attempt === 0) continue;
        return {
          ok: false as const,
          status: upstream.status,
          errorName: "OpenAIEmptyReply",
          errorMessage: "OpenAI returned no reply",
        };
      }

      return { ok: true as const, status: upstream.status, reply };
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "UnknownError";
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      if (attempt === 0) continue;
      return { ok: false as const, status: undefined, errorName, errorMessage };
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

async function loadUserContext(userId: string): Promise<UserContext | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("profiles")
      .select("display_name, email, roles, onboarding_state, onboarding_answers")
      .eq("id", userId)
      .maybeSingle();
    const profile = (data ?? null) as {
      display_name: string | null;
      email: string | null;
      roles: string[] | null;
      onboarding_state: string | null;
      onboarding_answers: Record<string, unknown> | null;
    } | null;
    if (!profile) return null;

    const answers =
      profile.onboarding_answers && typeof profile.onboarding_answers === "object"
        ? ((profile.onboarding_answers as { answers?: Record<string, unknown> }).answers ??
          (profile.onboarding_answers as Record<string, unknown>))
        : null;

    const name =
      (profile.display_name && profile.display_name.trim()) ||
      (profile.email && profile.email.split("@")[0]) ||
      "there";

    return {
      name,
      roles: profile.roles ?? [],
      location: profile.onboarding_state ?? "",
      topInterests: extractInterestsFromAnswers(answers, profile.roles, 3),
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const flagStatus = logMascotFlagMismatch("api/mascot-chat");
  const aiEnabled = flagStatus.serverEnabled;
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const hasOpenAIKey = Boolean(openaiKey);

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

  // Build 10: paid-only gate. Eligibility check first; auth required.
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const eligibility = await getJaxEligibility(user?.id ?? null, user?.email ?? null);
  if (!eligibility.eligible) {
    return NextResponse.json(
      {
        error: "jax_paid_only",
        message: "JAX is available with a paid plan.",
        upgradeUrl: "/pricing",
      },
      { status: 403 }
    );
  }

  // user is non-null here because eligibility.eligible can only be true with a userId.
  const userId = user!.id;

  // Per-user cap (skip for unlimited tiers).
  const monthlyLimit = eligibility.monthlyLimit;
  const currentUsage = await getUserMonthlyCount(userId);
  if (typeof monthlyLimit === "number" && currentUsage >= monthlyLimit) {
    return NextResponse.json(
      {
        error: "jax_cap_exceeded",
        message: `You've used your ${monthlyLimit} messages this month. Upgrade for more.`,
        upgradeUrl: "/pricing",
        monthlyLimit,
        currentUsage,
      },
      { status: 429 }
    );
  }

  // Global daily circuit breaker.
  const dailyCap = JAX_USAGE_HELPERS.getDailyGlobalCap();
  const dailyCount = await getGlobalDailyCount();
  if (dailyCount >= dailyCap) {
    console.error(
      `[mascot-chat] global circuit breaker tripped: ${dailyCount} >= ${dailyCap}`
    );
    return NextResponse.json(
      {
        error: "jax_global_cap",
        message: "JAX is taking a break — back tomorrow.",
      },
      { status: 503 }
    );
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
    return unavailableResponse("AI is temporarily unavailable. Please try again soon.");
  }

  try {
    const body = await req.json();
    const messages = (body?.messages || []) as MascotMessage[];
    const contextMode = (body?.contextMode || "GENERIC") as MascotContext;
    const route = (body?.route || "/") as string;

    const lastUser = [...messages].reverse().find((message) => message.role === "user");
    const suggestions = quickRepliesByContext[contextMode] || [];
    if (!lastUser?.content) {
      return response({
        reply: "Tell me what you're looking for and I'll pull real results.",
        mood: "CHILL",
        results: { type: "none", items: [] },
        suggestions,
      });
    }

    const safety = checkSafety(lastUser.content);
    if (safety) {
      return response({
        reply: safety.reply,
        mood: safety.mood,
        results: { type: "none", items: [] },
        suggestions: safety.suggestions,
      });
    }

    const intent = classifyIntent(lastUser.content, contextMode);
    const normalized = lastUser.content.toLowerCase();

    let basePayload: BasePayload;

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

    const userContext = await loadUserContext(userId);

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
      userContext,
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

    // OpenAI succeeded — burn one message off the user's monthly quota
    // and increment the global daily counter. Errors here are logged but
    // do not block the response (the user already got their answer).
    try {
      await incrementUserMonthly(userId);
      await incrementGlobalDaily();
    } catch (err) {
      console.error("[mascot-chat] usage increment failed", err);
    }

    setMascotLastError(null);
    console.info(
      `[mascot-chat] requestId=${requestId} status=200 tier=${eligibility.tier} flags:client=${flagStatus.clientEnabled} server=${flagStatus.serverEnabled} key=${hasOpenAIKey}`
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
    return response({
      reply: "AI is temporarily unavailable. Please try again soon.",
      mood: "ERROR",
      results: { type: "none", items: [] },
      suggestions: [],
    });
  }
}
