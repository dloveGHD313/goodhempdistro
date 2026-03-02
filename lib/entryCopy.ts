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
  primaryCTA: { label: "Create Account", href: "/signup" },
  secondaryCTA: { label: "Sign In", href: "/login" },
  scrollHint: "Choose your path",
} as const satisfies EntryHeroCopy;
