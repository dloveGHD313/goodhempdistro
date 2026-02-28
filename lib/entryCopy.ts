/**
 * Single source of truth for entry hero marketing copy.
 * Used by CinematicHero (/start) and WelcomeClient (/welcome).
 * Update here to change copy on both surfaces simultaneously.
 */

export type EntryHeroCopy = {
  /** Each element is one visual line; render with <br/> between or map to <p> elements. */
  headlineLines: readonly string[];
  subtitle: string;
  primaryCTA: { readonly label: string; readonly href: string };
  secondaryCTA: { readonly label: string; readonly href: string };
  /** Label above the scroll chevron in CinematicHero (omitted in WelcomeClient). */
  scrollHint: string;
};

export const entryHeroCopy = {
  headlineLines: ["The hemp industry,", "all in one place."],
  subtitle: "Community. Commerce. Compliance. Fused.",
  primaryCTA: { label: "Create Account", href: "/signup" },
  secondaryCTA: { label: "Sign In", href: "/login" },
  scrollHint: "Choose your path",
} as const satisfies EntryHeroCopy;
