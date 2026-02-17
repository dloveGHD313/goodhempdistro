import { HeroShell } from "@/components/ui/HeroShell";
import { FeatureSection } from "@/components/ui/FeatureSection";
import Link from "next/link";

export const metadata = {
  title: "Education Hub | Good Hemp Distro",
  description: "Learning with JAX episodes, compliance resources, and education by category.",
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
        <div className="surface-glass rounded-[var(--radius-xl)] p-6 sm:p-8 max-w-2xl">
          <p className="text-muted">Placeholder: episode list and video grid will go here.</p>
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
        <div className="surface-glass rounded-[var(--radius-xl)] p-6 sm:p-8 max-w-2xl">
          <p className="text-muted">Placeholder: state selector and compliance links will go here.</p>
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
