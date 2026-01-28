import type { MascotContext } from "@/components/mascot/config";

export type MascotIntent =
  | "feed_search"
  | "product_search"
  | "event_search"
  | "vendor_help"
  | "driver_deliveries"
  | "logistics_loads"
  | "order_lookup"
  | "general_help";

const has = (text: string, keywords: string[]) =>
  keywords.some((keyword) => text.includes(keyword));

export function classifyIntent(message: string, context: MascotContext): MascotIntent {
  const text = message.toLowerCase();

  if (has(text, ["order", "order id", "receipt", "confirmation"])) {
    return "order_lookup";
  }

  if (has(text, ["delivery", "deliveries", "route", "driver", "stop"])) {
    return "driver_deliveries";
  }

  if (has(text, ["load", "bol", "bill of lading", "pickup", "drop"])) {
    return "logistics_loads";
  }

  if (has(text, ["event", "expo", "meetup", "show", "conference"])) {
    return "event_search";
  }

  if (has(text, ["product", "shop", "price", "under $", "under", "vendor"])) {
    return "product_search";
  }

  if (has(text, ["coa", "listing", "approve", "approval", "vendor", "onboarding"])) {
    return "vendor_help";
  }

  if (context === "FEED") {
    return "feed_search";
  }

  return "general_help";
}
