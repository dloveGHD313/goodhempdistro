import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import Footer from "@/components/Footer";
import AskJaxChat from "./AskJaxChat";

export const metadata: Metadata = {
  title: "Ask JAX | Good Hemp Distro",
  description:
    "JAX is Good Hemp Distro's hemp-compliance copilot. Product education, COA literacy, state-law questions, and platform help — included with paid plans.",
  openGraph: {
    title: "Ask JAX | Good Hemp Distro",
    description:
      "JAX is Good Hemp Distro's hemp-compliance copilot. Product education, COA literacy, state-law questions, and platform help — included with paid plans.",
    url: `${brand.url}/ask-jax`,
    siteName: brand.name,
    type: "website",
  },
};

export default function AskJaxPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="welcome-hero py-10 px-4 futuristic-glow">
          <div className="max-w-3xl mx-auto text-center py-10">
            <p className="text-xs uppercase tracking-[0.35em] text-accent mb-4">Ask JAX</p>
            <h1 className="hero-title text-accent mb-4">Hemp&apos;s compliance copilot.</h1>
            <p className="hero-subtitle max-w-2xl mx-auto">
              Product education, COA literacy, state-law questions, vendor guidance, and product
              recommendations — powered by everything JAX knows about hemp and the GHD platform.
            </p>
          </div>
        </section>

        <section className="section-shell">
          <div className="max-w-3xl mx-auto">
            <AskJaxChat />

            <div className="grid md:grid-cols-3 gap-4 mt-10">
              {[
                {
                  icon: "🧪",
                  title: "COA literacy",
                  desc: "Understand lab results before you buy or list",
                },
                {
                  icon: "⚖️",
                  title: "Compliance aware",
                  desc: "Farm Bill, state laws, and age requirements",
                },
                {
                  icon: "🛒",
                  title: "Product matching",
                  desc: "Verified products and vendors, matched to you",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="surface-glass rounded-xl p-5 text-center border border-white/10"
                >
                  <p className="text-2xl mb-2">{item.icon}</p>
                  <p className="font-semibold text-white text-sm">{item.title}</p>
                  <p className="text-xs text-muted mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
