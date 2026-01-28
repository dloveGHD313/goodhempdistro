export type MascotContext =
  | "FEED"
  | "SHOP"
  | "EVENTS"
  | "VENDOR"
  | "DELIVERY_DRIVER"
  | "B2B_LOGISTICS"
  | "GENERIC";

export type MascotMood =
  | "CHILL"
  | "FOCUSED"
  | "EDUCATIONAL"
  | "URGENT"
  | "SUCCESS"
  | "ERROR"
  | "BLOCKED"
  | "COMPLIANCE"
  | "LEGAL";

export type MascotMove =
  | "idle_bounce"
  | "typing_pulse"
  | "focused_lean"
  | "success_nod"
  | "error_shake"
  | "blocked_stop"
  | "attention_pop"
  | "idle_still";

export type MascotId = "JAX" | "LEDGER" | "MILES" | "ATLAS";

export const mascotByContext: Record<MascotContext, MascotId> = {
  FEED: "JAX",
  SHOP: "JAX",
  EVENTS: "JAX",
  VENDOR: "LEDGER",
  DELIVERY_DRIVER: "MILES",
  B2B_LOGISTICS: "ATLAS",
  GENERIC: "JAX",
};

export const mascotAssets: Record<
  MascotId,
  {
    name: string;
    idleSrc: string;
    fallbackSrc: string;
    accent: string;
    tagline: string;
  }
> = {
  JAX: {
    name: "Jax",
    idleSrc: "/mascot/jax/idle.png",
    fallbackSrc: "/brand/goodhempdistrologo.png",
    accent: "var(--accent)",
    tagline: "Community concierge",
  },
  LEDGER: {
    name: "Ledger",
    idleSrc: "/mascot/ledger/idle.png",
    fallbackSrc: "/brand/goodhempdistrologo.png",
    accent: "var(--accent)",
    tagline: "Compliance guide",
  },
  MILES: {
    name: "Miles",
    idleSrc: "/mascot/miles/idle.png",
    fallbackSrc: "/brand/goodhempdistrologo.png",
    accent: "var(--accent)",
    tagline: "Driver ops",
  },
  ATLAS: {
    name: "Atlas",
    idleSrc: "/mascot/atlas/idle.png",
    fallbackSrc: "/brand/goodhempdistrologo.png",
    accent: "var(--accent)",
    tagline: "Logistics ops",
  },
};

export const quickRepliesByContext: Record<MascotContext, string[]> = {
  FEED: ["Find posts", "Trending", "Vendor posts", "Post help"],
  SHOP: ["Find products", "Under $50", "Top vendors", "What's a COA?"],
  EVENTS: ["Near me", "This weekend", "Hemp expos", "Vendor networking"],
  VENDOR: ["List product", "Upload COA", "Approval status", "Fulfill orders"],
  DELIVERY_DRIVER: ["My deliveries today", "Next stop", "Delivery details", "Report issue"],
  B2B_LOGISTICS: ["Available loads", "My assigned loads", "Load details", "Upload documents/BOL"],
  GENERIC: ["Explore the feed", "Find products", "Upcoming events", "Get started"],
};
