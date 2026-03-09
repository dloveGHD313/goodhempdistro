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
