/**
 * Phase 0 "why are you here?" intents — the nine doors from the CEO roadmap
 * (Shop, Sell, Events, Explore, Services, Drivers, Affiliates, Business,
 * Industrial). Keys match WELCOME_INTENT_OPTIONS in lib/phase0-storage.ts and
 * the role priority in lib/onboarding/role.ts, so the boot sequence, the
 * localStorage profile, profiles.welcome_intents and the questionnaire all
 * speak the same nine words.
 *
 * Copy rule: every line is a promise the site can keep today (CEO rule —
 * evidence-based only). JAX lines are short because they animate in.
 */
import type { WelcomeIntentOption } from "@/lib/phase0-storage";

export type IntentAccent = "green" | "gold" | "teal" | "violet";

export type WelcomeIntentCard = {
  key: WelcomeIntentOption;
  title: string;
  sub: string;
  /** Single glyph rendered in the card corner (no emoji fonts needed). */
  glyph: string;
  accent: IntentAccent;
  /** What JAX says when this intent is (most recently) toggled on. */
  jaxLine: string;
};

export const welcomeIntentCards: readonly WelcomeIntentCard[] = [
  {
    key: "shop",
    title: "Shop",
    sub: "Everyday hemp goods from verified vendors",
    glyph: "◈",
    accent: "green",
    jaxLine: "Shopping? I'll line up the catalog and flag what's COA-ready.",
  },
  {
    key: "sell",
    title: "Sell",
    sub: "Open a storefront as a founding vendor",
    glyph: "◆",
    accent: "gold",
    jaxLine: "Selling? Founding vendors get the first year free — I'll set up your storefront.",
  },
  {
    key: "industrial",
    title: "Build with hemp",
    sub: "Hempcrete, hurd, binder, blocks, insulation",
    glyph: "▲",
    accent: "teal",
    jaxLine: "Building? Drop your dimensions and I'll size the materials and match suppliers.",
  },
  {
    key: "business",
    title: "Business / wholesale",
    sub: "Buy for a store, a crew, or a company",
    glyph: "▣",
    accent: "green",
    jaxLine: "Buying for a business? I'll route you to wholesale and bulk listings.",
  },
  {
    key: "services",
    title: "Services",
    sub: "Offer or hire — labs, contractors, designers",
    glyph: "✚",
    accent: "teal",
    jaxLine: "Services? I'll put your offer where builders and vendors are looking.",
  },
  {
    key: "drivers",
    title: "Drive",
    sub: "Deliver on-demand with GHD or list your own service",
    glyph: "➤",
    accent: "gold",
    jaxLine: "Driving? Two lanes: on-demand with us, or list your own service. I'll ask which after signup.",
  },
  {
    key: "events",
    title: "Events",
    sub: "Host or attend hemp events",
    glyph: "✦",
    accent: "violet",
    jaxLine: "Events? Hosting runs through the vendor side — I'll get you set up.",
  },
  {
    key: "affiliates",
    title: "Refer & earn",
    sub: "Affiliate portal, no paid account needed",
    glyph: "↗",
    accent: "violet",
    jaxLine: "Referring? Your affiliate portal is free — I'll unlock it once you're in.",
  },
  {
    key: "explore",
    title: "Explore",
    sub: "Community, Learning with JAX, the feed",
    glyph: "◎",
    accent: "green",
    jaxLine: "Just looking around? Cool — I'll start you on the feed and the episodes.",
  },
] as const;

export const welcomeIntentKeys = welcomeIntentCards.map((c) => c.key) as readonly WelcomeIntentOption[];

/**
 * JAX's line for the current selection. The most recent toggle wins so the
 * bubble always reacts to what the visitor just did; with nothing selected it
 * asks the question; with several selected it acknowledges the combo.
 */
export function jaxLineFor(selected: readonly string[], lastToggled?: string | null): string {
  if (selected.length === 0) return "Pick everything that fits — I'll tailor the whole platform to it.";
  const last = lastToggled && selected.includes(lastToggled) ? lastToggled : selected[selected.length - 1];
  const card = welcomeIntentCards.find((c) => c.key === last);
  if (!card) return "Good picks. Let me tailor your experience.";
  if (selected.length >= 3) return `${card.jaxLine} All right, bet — that's a full setup. Let's do it.`;
  return card.jaxLine;
}

/**
 * Primary door for the after-signup hand-off, mirroring the role priority in
 * lib/onboarding/role.ts (sell > drivers > industrial > events > services >
 * affiliates > business > shop > explore).
 */
export function primaryIntent(selected: readonly string[]): WelcomeIntentOption | null {
  const priority: WelcomeIntentOption[] = [
    "sell",
    "drivers",
    "industrial",
    "events",
    "services",
    "affiliates",
    "business",
    "shop",
    "explore",
  ];
  const set = new Set(selected.map((s) => String(s).toLowerCase().trim()));
  return priority.find((p) => set.has(p)) ?? null;
}

/** Signup role hint derived from the primary intent (used as ?role= on /signup). */
export function signupRoleFor(selected: readonly string[]): string | null {
  const p = primaryIntent(selected);
  if (!p) return null;
  if (p === "sell" || p === "events" || p === "services" || p === "industrial") return "vendor";
  if (p === "drivers") return "driver";
  if (p === "affiliates") return "affiliate";
  return "consumer";
}

/** Session/visitor flag so the boot sequence plays once, not on every visit. */
export const BOOT_SEEN_KEY = "ghd_boot_seen_v1";

/**
 * Gate rule (CEO decision pending, Sep 2026). The roadmap's literal rule is
 * "no interaction without an account"; the growth strategy needs public pages
 * for SEO and outreach. `requireIntent: true` = the visitor must pick at least
 * one door before the page opens (roadmap). Flip to false to show a quiet
 * "Skip for now" link for visitors who only want to browse.
 */
export const welcomeGate = {
  requireIntent: true,
} as const;
