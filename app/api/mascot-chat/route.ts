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

type MascotMessage = { role: "user" | "assistant"; content: string };

const aiEnabled = process.env.MASCOT_AI_ENABLED === "true";

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

export async function POST(req: NextRequest) {
  if (!aiEnabled) {
    return response({
      reply: "Mascot AI is offline right now.",
      mood: "BLOCKED",
      results: { type: "none", items: [] },
      suggestions: [],
    });
  }

  try {
    const body = await req.json();
    const messages = (body?.messages || []) as MascotMessage[];
    const contextMode = (body?.contextMode || "GENERIC") as MascotContext;

    const lastUser = [...messages].reverse().find((message) => message.role === "user");
    if (!lastUser?.content) {
      return response({
        reply: "Tell me what you're looking for and I'll pull real results.",
        mood: "CHILL",
        results: { type: "none", items: [] },
        suggestions: quickRepliesByContext[contextMode] || [],
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
    const suggestions = quickRepliesByContext[contextMode] || [];

    if (intent === "product_search") {
      const maxPrice = normalized.includes("under $50") ? 5000 : undefined;
      const query = normalizeProductQuery(lastUser.content);
      const items = await searchProducts(query, { maxPriceCents: maxPrice, limit: 6 });
      return response({
        reply: items.length
          ? "Here are verified products matching your search."
          : "No verified products matched that yet. Try another keyword or filter.",
        mood: items.length ? "SUCCESS" : "FOCUSED",
        results: { type: "products", items },
        suggestions,
      });
    }

    if (intent === "event_search") {
      const items = await searchEvents(lastUser.content, { limit: 6 });
      return response({
        reply: items.length
          ? "Here are upcoming events that match."
          : "No upcoming events matched that. Try a different search.",
        mood: items.length ? "SUCCESS" : "FOCUSED",
        results: { type: "events", items },
        suggestions,
      });
    }

    if (intent === "feed_search") {
      const items = await searchFeedPosts();
      return response({
        reply: items.length
          ? "Here are verified feed posts."
          : "I don't see verified posts matching that yet. Try products or events.",
        mood: items.length ? "SUCCESS" : "FOCUSED",
        results: { type: "posts", items },
        suggestions,
      });
    }

    if (intent === "vendor_help") {
      const results = getVendorHelp(lastUser.content);
      return response({
        reply: "Here's the fastest path for vendors.",
        mood: "EDUCATIONAL",
        results,
        suggestions,
      });
    }

    if (intent === "driver_deliveries") {
      const items = await getDriverDeliveries();
      return response({
        reply: items.length
          ? "Here are your latest deliveries."
          : "No deliveries found yet for your driver profile.",
        mood: items.length ? "SUCCESS" : "FOCUSED",
        results: { type: "deliveries", items },
        suggestions,
      });
    }

    if (intent === "logistics_loads") {
      const items = await getLogisticsLoads();
      return response({
        reply: items.length
          ? "Here are your assigned loads."
          : "No verified loads are available yet for your logistics profile.",
        mood: items.length ? "SUCCESS" : "FOCUSED",
        results: { type: "loads", items },
        suggestions,
      });
    }

    if (intent === "order_lookup") {
      const match = lastUser.content.match(uuidRegex);
      const orderId = match ? match[0] : "";
      const items = await getOrderDetails(orderId);
      return response({
        reply: items.length
          ? "Here's the order I found."
          : "I couldn't find that order. Double-check the ID or check your account.",
        mood: items.length ? "SUCCESS" : "FOCUSED",
        results: { type: "links", items },
        suggestions,
      });
    }

    return response({
      reply: "Tell me what you want to do and I'll point you to the right place.",
      mood: "CHILL",
      results: { type: "none", items: [] },
      suggestions,
    });
  } catch (error) {
    console.error("[mascot-chat] error", error);
    return response({
      reply: "I hit a snag pulling that. Try again in a moment.",
      mood: "ERROR",
      results: { type: "none", items: [] },
      suggestions: [],
    });
  }
}
