import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Meet JAX — your personal hemp industry guide",
  description:
    "JAX is the AI assistant inside Good Hemp Distro. Compliance answers, product matching, vendor recommendations — built for paid members.",
  openGraph: {
    title: "Meet JAX — your personal hemp industry guide",
    description:
      "Compliance answers, product matching, vendor recommendations — JAX is the AI assistant inside Good Hemp Distro, built for paid members.",
    type: "website",
  },
};

const FEATURES = [
  {
    icon: "📋",
    title: "Compliance answers",
    body: "State-aware guidance on what you can ship, sell, and stock — no more digging through regulator PDFs.",
  },
  {
    icon: "🛍️",
    title: "Product matching",
    body: "Tell JAX what you're looking for and get verified, COA-backed product recommendations from real vendors.",
  },
  {
    icon: "🤝",
    title: "Vendor recommendations",
    body: "JAX knows your role, location, and interests, and surfaces the right brands, distributors, and services.",
  },
];

const TIERS = [
  { name: "Paid Consumer", limit: "100 messages / month" },
  { name: "Vendor Starter", limit: "200 messages / month" },
  { name: "Vendor Mid", limit: "1,000 messages / month" },
  { name: "Vendor Top", limit: "Unlimited" },
];

export default function JaxPreviewPage() {
  return (
    <main className="min-h-screen bg-[#0D1512] text-[#F0EDE6] font-sans">
      <section className="px-6 py-20 md:py-28">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-[#3CB97A] mb-3">
            Inside Good Hemp Distro
          </p>
          <h1 className="text-4xl md:text-6xl font-serif mb-6">
            Meet JAX — your personal hemp industry guide
          </h1>
          <p className="text-lg text-[#8A9E96] max-w-2xl mx-auto mb-10">
            JAX is the AI assistant inside Good Hemp Distro. State-aware,
            role-aware, and trained on the platform&apos;s catalog of
            verified vendors and products.
          </p>
          <Link
            href="/pricing"
            className="inline-block px-7 py-3 rounded-xl font-semibold text-[#0D1512] bg-[#3CB97A] hover:scale-[1.02] transition-all duration-200"
          >
            Upgrade to unlock JAX →
          </Link>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="bg-[#141F1A] border-l-4 border-[#3CB97A] p-8 rounded-r-xl"
            >
              <p className="text-3xl mb-4">{feature.icon}</p>
              <h2 className="text-xl text-[#F0EDE6] mb-3 font-serif">{feature.title}</h2>
              <p className="text-[#8A9E96] text-sm leading-relaxed">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-serif text-center mb-2">
            Message limits by plan
          </h2>
          <p className="text-[#8A9E96] text-sm text-center mb-10">
            Caps reset on the 1st of each month (UTC).
          </p>
          <div className="border border-white/10 rounded-xl overflow-hidden divide-y divide-white/10">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="flex items-center justify-between px-6 py-4 bg-[#141F1A]/60"
              >
                <span className="font-medium text-[#F0EDE6]">{tier.name}</span>
                <span className="text-sm text-[#8A9E96]">{tier.limit}</span>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/pricing"
              className="inline-block px-7 py-3 rounded-xl font-semibold text-[#3CB97A] border border-[#3CB97A] hover:bg-[#1A2820] transition-colors"
            >
              See plans
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
