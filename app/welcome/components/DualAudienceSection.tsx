import Link from "next/link";
import SectionReveal from "./SectionReveal";

type DualAudienceSectionProps = {
  isAuthenticated?: boolean;
};

/**
 * Three audiences, three lanes — mirrors the hero doors (Shop / Build / Sell)
 * so a visitor who scrolled past JAX still lands on the right path.
 */
export default function DualAudienceSection({ isAuthenticated = false }: DualAudienceSectionProps) {
  const vendorHref = isAuthenticated ? "/vendor-registration" : "/get-started?role=vendor";
  return (
    <section className="grid md:grid-cols-3">
      <SectionReveal className="h-full" delayMs={50}>
        <article className="h-full bg-[#141F1A] border-l-4 border-[#3CB97A] p-10 md:p-12 transition-all duration-200 hover:-translate-y-1 hover:border-[#6ed4a1]">
          <p className="text-3xl mb-6">🛍️</p>
          <p className="text-xs uppercase tracking-[0.3em] text-[#3CB97A] mb-4">FOR SHOPPERS</p>
          <h2 className="text-3xl md:text-4xl text-[#F0EDE6] mb-5 font-serif">Everyday hemp, verified</h2>
          <p className="text-[#8A9E96] mb-6 max-w-lg">
            Apparel, paper, home goods, food, wellness and pet products from vendors we review before they list.
            COAs wherever the category calls for one.
          </p>
          <Link href="/categories" className="text-[#3CB97A] font-semibold hover:underline">
            Browse categories →
          </Link>
        </article>
      </SectionReveal>

      <SectionReveal className="h-full" delayMs={100}>
        <article className="h-full bg-[#141F1A] border-l-4 border-[#1FA6A8] p-10 md:p-12 transition-all duration-200 hover:-translate-y-1 hover:border-[#5fd3d5]">
          <p className="text-3xl mb-6">🏗️</p>
          <p className="text-xs uppercase tracking-[0.3em] text-[#3FCFD1] mb-4">FOR BUILDERS</p>
          <h2 className="text-3xl md:text-4xl text-[#F0EDE6] mb-5 font-serif">Build with hemp</h2>
          <p className="text-[#8A9E96] mb-6 max-w-lg">
            Submit a project — dimensions, timeline, budget, even blueprints — and get matched to the vendors
            who supply hurd, binder, blocks and insulation. Or start with the material estimator.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/projects/submit" className="text-[#3FCFD1] font-semibold hover:underline">
              Submit a project →
            </Link>
            <Link href="/projects/estimator" className="text-[#3FCFD1] font-semibold hover:underline">
              Estimate materials →
            </Link>
          </div>
        </article>
      </SectionReveal>

      <SectionReveal className="h-full" delayMs={150}>
        <article className="h-full bg-[#141F1A] border-l-4 border-[#C9A84C] p-10 md:p-12 transition-all duration-200 hover:-translate-y-1 hover:border-[#e4c976]">
          <p className="text-3xl mb-6">🏪</p>
          <p className="text-xs uppercase tracking-[0.3em] text-[#C9A84C] mb-4">FOR VENDORS</p>
          <h2 className="text-3xl md:text-4xl text-[#F0EDE6] mb-5 font-serif">Grow your hemp business</h2>
          <p className="text-[#8A9E96] mb-6 max-w-lg">
            List products, manage COAs, reach wholesale buyers, and get matched to real
            projects — with founding-vendor placement while the network is young.
          </p>
          <Link href={vendorHref} className="text-[#C9A84C] font-semibold hover:underline">
            Start selling →
          </Link>
        </article>
      </SectionReveal>
    </section>
  );
}
