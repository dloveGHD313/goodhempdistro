export type EntryHeroCopy = {
  headlineLines: readonly string[];
  subtitle: string;
  primaryCTA: { label: string; href: string };
  secondaryCTA: { label: string; href: string };
  scrollHint?: string;
};

export const entryHeroCopy = {
  headlineLines: ["The hemp industry,", "all in one place."],
  subtitle: "Community. Commerce. Compliance. Fused.",
  primaryCTA: { label: "Browse the Marketplace", href: "/products" },
  secondaryCTA: { label: "Become a Vendor", href: "/vendor-registration" },
  scrollHint: "Choose your path",
} as const satisfies EntryHeroCopy;

/**
 * Home-page path chooser (JAX-guided first visit). Three doors, one question.
 * Copy is the single source of truth for the hero so marketing edits never
 * touch layout code. Keep every claim here evidence-based (CEO rule).
 */
export type EntryPathKey = "shop" | "build" | "sell";

export type EntryPath = {
  key: EntryPathKey;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  /** What JAX says when this door is hovered/focused. */
  jaxLine: string;
  accent: "green" | "gold" | "teal";
};

export const entryPaths: readonly EntryPath[] = [
  {
    key: "shop",
    eyebrow: "I want to shop",
    title: "Everyday hemp goods",
    body: "Apparel, paper, home goods, food, wellness, pet — from vendors we've verified.",
    cta: "Browse the catalog",
    href: "/categories?intent=shop",
    jaxLine: "Shopping? Let me show you what's live and what's coming. Everything COA-ready where the law asks for it.",
    accent: "green",
  },
  {
    key: "build",
    eyebrow: "I'm building with hemp",
    title: "Hempcrete & materials",
    body: "Submit a project or run the material estimator — we route it to the vendors who supply each line item.",
    cta: "Plan a project",
    href: "/projects/submit?intent=build",
    jaxLine: "Building? Drop your dimensions, timeline, even blueprints. I'll match you with hurd, binder, blocks and insulation suppliers.",
    accent: "teal",
  },
  {
    key: "sell",
    eyebrow: "I make hemp products",
    title: "Become a founding vendor",
    body: "Your own storefront, contractor and developer leads, and placement in Learning with JAX.",
    cta: "Start selling",
    href: "/get-started?role=vendor&intent=sell",
    jaxLine: "Selling? Founding vendors get in before the catalog opens wide — your storefront, your brand, your pricing.",
    accent: "gold",
  },
] as const;

/**
 * Founding-vendor offer line shown on the Sell door.
 * CEO decision: the free first year is the offer being pitched in vendor
 * outreach (Sep 2026). Flip `enabled` off to hide the line site-wide without
 * touching layout. Requires the comp feature (vendors.comp_until) in production
 * so an activated founding vendor actually gets the free months.
 */
export const foundingVendorOffer = {
  enabled: true,
  line: "First year free for founding vendors — no subscription for 12 months, standard commission only.",
} as const;

export const jaxHeroCopy = {
  greeting: "Hey, I'm JAX. Where do you want to start?",
  idleLine: "Pick a door — I'll take it from there.",
} as const;
