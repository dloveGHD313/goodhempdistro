import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { HeroShell } from "@/components/ui/HeroShell";
import { FeatureSection } from "@/components/ui/FeatureSection";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Hemp Education Hub | Good Hemp Distro",
  description:
    "Learn about hemp compliance, COA reading, vendor best practices, and industry knowledge. Educational resources for buyers and sellers.",
  openGraph: {
    title: "Hemp Education Hub | Good Hemp Distro",
    description:
      "Learn about hemp compliance, COA reading, vendor best practices, and industry knowledge. Educational resources for buyers and sellers.",
    url: `${brand.url}/education`,
    siteName: brand.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hemp Education Hub | Good Hemp Distro",
    description:
      "Learn about hemp compliance, COA reading, vendor best practices, and industry knowledge. Educational resources for buyers and sellers.",
  },
};

const CATEGORIES = [
  "Farming",
  "Retail",
  "Logistics",
  "Construction",
  "Compliance",
] as const;

export default function EducationPage() {
  return (
    <div className="min-h-screen text-white">
      <section className="welcome-hero py-10 px-4 futuristic-glow">
        <HeroShell cinematic glassPanel={false} contentClassName="max-w-3xl">
          <p className="text-xs uppercase tracking-[0.35em] text-muted mb-2">Education Hub</p>
          <h1 className="hero-title text-accent mb-2">Learn, Watch, Stay Compliant</h1>
          <p className="hero-subtitle">
            Learning with JAX episodes, state-by-state compliance resources, and guides by category.
          </p>
        </HeroShell>
      </section>

      <FeatureSection
        eyebrow="Learning with JAX"
        title="Episodes &amp; Videos"
        description="Watch educational content and follow along with JAX. (Episodes coming soon.)"
        gradient
        contentClassName="px-4"
      >
        <div className="rounded-lg border border-dashed border-[#C9A84C]/30 bg-[#0D1512] p-8 text-center max-w-2xl">
          <p className="text-sm font-medium text-[#C9A84C] mb-2">Coming Soon</p>
          <p className="text-[#8A9E96] text-sm">
            Regional consumer guidance for hemp purchasing is on its way. Check back soon or join our
            education waitlist.
          </p>
          <Link href="/discover" className="text-accent hover:underline mt-2 inline-block">
            Browse discover in the meantime →
          </Link>
        </div>
      </FeatureSection>

      <FeatureSection
        eyebrow="Compliance &amp; Rules"
        title="State-by-State Resources"
        description="Find rules and compliance guidance by state. (Resources coming soon.)"
        contentClassName="px-4"
      >
        <div className="rounded-lg border border-dashed border-[#3CB97A]/30 bg-[#0D1512] p-8 text-center max-w-2xl">
          <p className="text-sm font-medium text-[#3CB97A] mb-2">Coming Soon</p>
          <p className="text-[#8A9E96] text-sm">
            State-by-state hemp compliance requirements are being compiled. Sign up to be notified when
            your state is added.
          </p>
          <Link href="/signup" className="mt-4 inline-block text-sm text-[#3CB97A] underline hover:opacity-80">
            Notify me →
          </Link>
        </div>
      </FeatureSection>

      <FeatureSection
        eyebrow="Categories"
        title="Explore by Topic"
        description="Farming, retail, logistics, construction, and compliance."
        contentClassName="px-4"
      >
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map((name) => (
            <span
              key={name}
              className="inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 px-4 py-2 text-sm text-foreground"
            >
              {name}
            </span>
          ))}
        </div>
      </FeatureSection>
    </div>
  );
}
