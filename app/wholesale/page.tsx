import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import Footer from "@/components/Footer";
import { createSupabaseServerClient } from "@/lib/supabase";
import {
  FORM_TS_FIELD,
  HONEYPOT_FIELD,
  formSpamCheck,
} from "@/lib/server/antiSpam";
import FormSpamGuardFields from "@/components/FormSpamGuardFields";
import TurnstileWidget from "@/components/TurnstileWidget";
import { headers } from "next/headers";
import { requireHumanFromForm } from "@/lib/server/turnstile";
import { getPlatformStats } from "@/lib/server/platformStats";

export const metadata: Metadata = {
  title: "Hemp Wholesale Inquiry | Good Hemp Distro",
  description:
    "Submit a wholesale inquiry to connect with verified hemp vendors for bulk orders, distribution partnerships, and B2B sourcing.",
  openGraph: {
    title: "Hemp Wholesale Inquiry | Good Hemp Distro",
    description:
      "Submit a wholesale inquiry to connect with verified hemp vendors for bulk orders, distribution partnerships, and B2B sourcing.",
    url: `${brand.url}/wholesale`,
    siteName: brand.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hemp Wholesale Inquiry | Good Hemp Distro",
    description:
      "Submit a wholesale inquiry to connect with verified hemp vendors for bulk orders, distribution partnerships, and B2B sourcing.",
  },
};

async function submitInquiry(formData: FormData) {
  "use server";

  const business_name = String(formData.get("business_name") || "").trim();
  const contact_name = String(formData.get("contact_name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const volume = String(formData.get("volume") || "").trim();
  const message = String(formData.get("message") || "").trim();

  if (!business_name || !contact_name || !email || !category) {
    redirect("/wholesale?error=1");
  }

  // Bot/spam gate: honeypot + minimum fill time + email verdict.
  const spamReason = formSpamCheck({
    honeypot: formData.get(HONEYPOT_FIELD),
    formTs: formData.get(FORM_TS_FIELD),
    email,
  });
  if (spamReason) {
    console.warn("[wholesale-inquiry] blocked submission:", spamReason);
    // Generic success so bots learn nothing.
    redirect("/wholesale?submitted=1");
  }

  // Human verification (Cloudflare Turnstile) — no-op until keys are set.
  if (await requireHumanFromForm(formData, await headers())) {
    redirect("/wholesale?error=human");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("wholesale_inquiries").insert({
    business_name,
    contact_name,
    email,
    phone: phone || null,
    category,
    volume: volume || null,
    message: message || null,
  });

  if (error) {
    redirect("/wholesale?error=1");
  }

  redirect("/wholesale?submitted=1");
}

export default async function WholesalePage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const params = await searchParams;
  const submitted = params.submitted === "1";
  const hasError = params.error === "1";
  const humanError = params.error === "human";

  // Live counts only (CEO rule: no hand-typed marketing numbers). Unknown → hidden.
  const stats = await getPlatformStats().catch(() => null);
  const fmt = (n: number | null | undefined) =>
    typeof n === "number" && n > 0 ? n.toLocaleString("en-US") : null;
  const trustStats = [
    { value: fmt(stats?.activeVendors), label: "Founding Vendors Onboarded" },
    { value: fmt(stats?.categories), label: "Hemp Categories" },
    { value: "COA", label: "Required on Cannabinoid Products" },
    { value: "21+", label: "Age-Gated Platform" },
  ].filter((s): s is { value: string; label: string } => Boolean(s.value));

  return (
    <div className="min-h-screen text-white flex flex-col">
      {/* === TRUST STATS BAR (live DB counts) === */}
      <section className="border-b border-white/10 bg-[#141F1A]">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {trustStats.map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-semibold text-[#3CB97A]">{stat.value}</p>
                <p className="text-xs text-[#8A9E96] mt-1 uppercase tracking-wide">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="card-glass p-8 md:p-10">
              <h1 className="text-4xl md:text-5xl font-bold mb-4 text-accent">
                Wholesale Hemp Distribution — Built for Retailers &amp; Brands
              </h1>
              <p className="text-muted text-lg">
                Access bulk pricing, verified COA products, and dedicated account support.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="surface-card p-6">
                <h2 className="text-xl font-semibold mb-2">📦 Bulk Pricing</h2>
                <p className="text-muted">Volume discounts across all product categories</p>
              </div>
              <div className="surface-card p-6">
                <h2 className="text-xl font-semibold mb-2">🧪 Verified COA Products</h2>
                <p className="text-muted">Every product comes with lab-verified documentation</p>
              </div>
              <div className="surface-card p-6">
                <h2 className="text-xl font-semibold mb-2">🤝 Dedicated Account Support</h2>
                <p className="text-muted">A real person manages your account from day one</p>
              </div>
            </div>

            {/* === HOW WHOLESALE WORKS === */}
            <section className="max-w-5xl mx-auto px-6 py-16">
              <div className="text-center mb-12">
                <p className="text-xs uppercase tracking-widest text-[#3CB97A] mb-3">Simple Process</p>
                <h2 className="text-3xl font-serif text-[#F0EDE6]">How wholesale works</h2>
              </div>
              <div className="grid md:grid-cols-3 gap-8">
                {[
                  {
                    step: "01",
                    title: "Submit an inquiry",
                    body: "Fill out the wholesale inquiry form below. Tell us about your business, volume needs, and preferred product categories.",
                    accent: "#3CB97A",
                  },
                  {
                    step: "02",
                    title: "Get matched with vendors",
                    body: "Our team reviews your inquiry and connects you with verified GHD vendors that match your requirements and location.",
                    accent: "#C9A84C",
                  },
                  {
                    step: "03",
                    title: "Review COAs and order",
                    body: "Every product comes with a full-panel Certificate of Analysis. Review lab results, confirm compliance, and place your order.",
                    accent: "#3CB97A",
                  },
                ].map((item) => (
                  <div key={item.step} className="relative">
                    <p
                      className="text-5xl font-serif font-bold mb-4 opacity-20"
                      style={{ color: item.accent }}
                    >
                      {item.step}
                    </p>
                    <h3 className="text-lg font-semibold text-[#F0EDE6] mb-3">{item.title}</h3>
                    <p className="text-sm text-[#8A9E96] leading-relaxed">{item.body}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* === VENDOR CTA === */}
            <section className="max-w-5xl mx-auto px-6 pb-8">
              <div className="rounded-2xl border border-[#3CB97A]/20 bg-[#141F1A] p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <p className="text-sm font-medium text-[#3CB97A] mb-1">Are you a hemp vendor?</p>
                  <h3 className="text-xl font-serif text-[#F0EDE6]">List your products on GHD</h3>
                  <p className="text-sm text-[#8A9E96] mt-2">
                    Reach wholesale buyers and retail customers. COA-verified listings only.
                  </p>
                </div>
                <a
                  href="/vendor-registration"
                  className="flex-shrink-0 px-6 py-3 bg-[#3CB97A] text-[#0D1512] font-semibold rounded-lg hover:opacity-90 text-sm whitespace-nowrap"
                >
                  Become a Vendor →
                </a>
              </div>
            </section>

            <div className="surface-card p-8">
              <h2 className="text-2xl font-semibold mb-6">Wholesale Inquiry Form</h2>

              {submitted ? (
                <p className="text-accent font-semibold">
                  Thank you! Our wholesale team will be in touch within 24 hours.
                </p>
              ) : (
                <form action={submitInquiry} className="space-y-5">
                  <FormSpamGuardFields />
                  {hasError && (
                    <div className="p-3 rounded bg-red-500/20 text-red-200 text-sm" role="alert">
                      Submission failed. Please email us directly to reach our team.
                    </div>
                  )}
                  {humanError && (
                    <div className="p-3 rounded bg-red-500/20 text-red-200 text-sm" role="alert">
                      We couldn&apos;t verify you&apos;re human. Please refresh the page and try again.
                    </div>
                  )}

                  <div>
                    <label htmlFor="business_name" className="block text-sm font-medium text-muted mb-1">
                      Business Name
                    </label>
                    <input id="business_name" name="business_name" type="text" required className="input-shell w-full" />
                  </div>

                  <div>
                    <label htmlFor="contact_name" className="block text-sm font-medium text-muted mb-1">
                      Contact Name
                    </label>
                    <input id="contact_name" name="contact_name" type="text" required className="input-shell w-full" />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-muted mb-1">
                      Email
                    </label>
                    <input id="email" name="email" type="email" required className="input-shell w-full" />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-muted mb-1">
                      Phone
                    </label>
                    <input id="phone" name="phone" type="tel" className="input-shell w-full" />
                  </div>

                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-muted mb-1">
                      Product Category Interest
                    </label>
                    <select id="category" name="category" required className="input-shell w-full">
                      <option value="">Select...</option>
                      <option value="Flower">Flower</option>
                      <option value="Edibles">Edibles</option>
                      <option value="Topicals">Topicals</option>
                      <option value="Concentrates">Concentrates</option>
                      <option value="All Categories">All Categories</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="volume" className="block text-sm font-medium text-muted mb-1">
                      Monthly Volume Estimate
                    </label>
                    <select id="volume" name="volume" className="input-shell w-full">
                      <option value="">Select...</option>
                      <option value="Under $5k">Under $5k</option>
                      <option value="$5k–$25k">$5k–$25k</option>
                      <option value="$25k–$100k">$25k–$100k</option>
                      <option value="$100k+">$100k+</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-muted mb-1">
                      Message
                    </label>
                    <textarea id="message" name="message" rows={4} className="input-shell w-full" />
                  </div>

                  <TurnstileWidget action="wholesale_inquiry" />
                  <button type="submit" className="btn-primary">
                    Submit Inquiry
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
