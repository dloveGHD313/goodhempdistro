import JaxPathChooser from "./JaxPathChooser";

type HeroSectionProps = {
  isAuthenticated?: boolean;
};

/**
 * Home hero v2 — "wow" without paying for it in LCP:
 * - The background is pure CSS (animated aurora gradients + SVG grain), no
 *   video, no JS, no extra requests; it pauses under prefers-reduced-motion.
 * - Eyebrow + H1 + subtitle are server-rendered plain elements (no opacity-0
 *   reveal on the LCP text). Only the doors stagger in.
 * - JAX asks one question and three doors answer it (Shop / Build / Sell).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function HeroSection(_props: HeroSectionProps = {}) {
  return (
    <section className="ghd-hero relative overflow-hidden px-6 pt-24 pb-20 md:pt-28 md:pb-24">
      <div className="ghd-aurora" aria-hidden />
      <div className="ghd-grain" aria-hidden />

      <div className="relative z-10 max-w-6xl mx-auto text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-[#3CB97A] mb-6">THE HEMP INDUSTRY PLATFORM</p>

        <h1 className="text-[#F0EDE6] text-5xl md:text-7xl leading-[1.05] mb-6 font-serif">
          Every vendor.<br />
          Every product.<br />
          <span className="ghd-shimmer">One platform.</span>
        </h1>

        <p className="text-[#8A9E96] text-lg max-w-2xl mx-auto mb-12">
          Shop everyday hemp goods, plan a hempcrete build, or open your own storefront —
          verified vendors, COA-ready listings, and JAX to walk you through it.
        </p>

        <JaxPathChooser />

        <div className="mt-10 flex flex-wrap justify-center gap-3 md:gap-8 text-sm text-[#4A5E57]">
          <span>✓ Founding vendors onboarding now</span>
          <span>✓ COA required where the law requires it</span>
          <span>✓ Nashville, TN + nationwide</span>
        </div>
      </div>
    </section>
  );
}
