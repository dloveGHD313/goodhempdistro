import Link from "next/link";
import SectionReveal from "./SectionReveal";

type DualAudienceSectionProps = {
  isAuthenticated?: boolean;
};

export default function DualAudienceSection({ isAuthenticated = false }: DualAudienceSectionProps) {
  const vendorHref = isAuthenticated ? "/vendor-registration" : "/get-started?role=vendor";
  return (
    <section className="grid md:grid-cols-2">
      <SectionReveal className="h-full" delayMs={50}>
        <article className="h-full bg-[#141F1A] border-l-4 border-[#3CB97A] p-10 md:p-14 transition-all duration-200 hover:-translate-y-1 hover:border-[#6ed4a1]">
          <p className="text-3xl mb-6">🛍️</p>
          <p className="text-xs uppercase tracking-[0.3em] text-[#3CB97A] mb-4">FOR CONSUMERS</p>
          <h2 className="text-4xl text-[#F0EDE6] mb-5 font-serif">Find Hemp Near You</h2>
          <p className="text-[#8A9E96] mb-6 max-w-lg">
            Browse lab-tested products from verified vendors. Check COAs, compare prices, and order with confidence.
          </p>
          <Link href="/products" className="text-[#3CB97A] font-semibold hover:underline">
            Shop Hemp Products →
          </Link>
        </article>
      </SectionReveal>

      <SectionReveal className="h-full" delayMs={125}>
        <article className="h-full bg-[#141F1A] border-l-4 border-[#C9A84C] p-10 md:p-14 transition-all duration-200 hover:-translate-y-1 hover:border-[#e4c976]">
          <p className="text-3xl mb-6">🏪</p>
          <p className="text-xs uppercase tracking-[0.3em] text-[#C9A84C] mb-4">FOR VENDORS</p>
          <h2 className="text-4xl text-[#F0EDE6] mb-5 font-serif">Grow Your Hemp Business</h2>
          <p className="text-[#8A9E96] mb-6 max-w-lg">
            List products, manage COAs, reach wholesale buyers, and get matched to real
            projects — with founding-vendor placement while the network is young.
          </p>
          <Link href={vendorHref} className="text-[#C9A84C] font-semibold hover:underline">
            Start Selling →
          </Link>
        </article>
      </SectionReveal>
    </section>
  );
}
