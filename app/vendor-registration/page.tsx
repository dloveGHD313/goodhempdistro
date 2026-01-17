"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Footer from "@/components/Footer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const vendorPackages = [
  {
    name: "BASIC",
    price: "$50",
    priceCents: 5000,
    commission: "7%",
    maxProducts: "25",
    features: [
      "Up to 25 products",
      "Standard product listing",
      "Event access",
      "Community badge",
      "Basic analytics",
    ],
  },
  {
    name: "PRO",
    price: "$125",
    priceCents: 12500,
    commission: "4%",
    maxProducts: "100",
    featured: true,
    features: [
      "Up to 100 products",
      "Priority placement",
      "Unlimited event participation",
      "Featured vendor badge",
      "Advanced analytics",
      "Vendor support",
    ],
  },
  {
    name: "ELITE",
    price: "$250",
    priceCents: 25000,
    commission: "0%",
    maxProducts: "Unlimited",
    features: [
      "Unlimited products",
      "Featured vendor status",
      "Wholesale access",
      "Event discounts (30%)",
      "COA discounts",
      "Priority support",
      "Custom branding",
    ],
  },
];

const vendorPerks = [
  {
    title: "Built-in Social Feed",
    description: "Engage with your customers and the community directly on the platform.",
  },
  {
    title: "Event Access",
    description: "Showcase your products at exclusive hemp marketplace events.",
  },
  {
    title: "Wholesale Opportunities",
    description: "Connect with other vendors and retailers (Elite tier).",
  },
  {
    title: "Advanced Analytics",
    description: "Track sales, customer behavior, and optimize your listings.",
  },
];

const faqItems = [
  {
    question: "Can I change my plan later?",
    answer: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect in your next billing cycle.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit and debit cards through Stripe, including Visa, Mastercard, American Express, and Discover.",
  },
  {
    question: "Is there a contract or commitment?",
    answer: "No long-term contracts. You can cancel your vendor account at any time.",
  },
  {
    question: "How are commissions calculated?",
    answer: "Commissions are calculated on the total sale amount (including tax and shipping) and deducted automatically from your payout.",
  },
  {
    question: "When do I get paid?",
    answer: "Payouts are processed weekly to your connected bank account. The first payout may take 5-7 business days.",
  },
];

export default function VendorRegistrationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleChoosePlan = async (packageName: string) => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    try {
      setLoading(true);

      // Check if user is logged in
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push(`/login?next=/vendor-registration`);
        return;
      }

      // Create Stripe checkout session
      const response = await fetch("/api/vendor/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageName,
          userId: data.user.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { sessionId } = await response.json();

      // Redirect to Stripe checkout
      if (typeof window !== "undefined") {
        // Use Stripe.js or redirect to checkout URL
        const stripeUrl = `https://checkout.stripe.com/pay/${sessionId}`;
        window.location.href = stripeUrl;
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell text-center hero-glow">
          <div className="hero-content max-w-3xl mx-auto">
            <h1 className="text-5xl font-bold mb-4 text-accent">
              Become a Vendor on Good Hemp Distro
            </h1>
            <p className="text-xl text-muted mb-8">
              Join our thriving marketplace. Reach thousands of customers, showcase your products in our community social feed, participate in exclusive events, and unlock wholesale opportunities. Start your vendor journey today.
            </p>
          </div>
        </section>

      {/* Pricing Table */}
      <section className="section-shell section-shell--tight">
        <h2 className="text-3xl font-bold mb-12 text-center text-accent">
          Simple, Transparent Pricing
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {vendorPackages.map((pkg) => (
            <div
              key={pkg.name}
              className={`surface-card p-8 rounded-lg border-2 transition transform ${
                pkg.featured
                  ? "border-[var(--brand-orange)] scale-105 shadow-2xl"
                  : "border-[var(--border)] hover:border-[var(--brand-lime)]"
              }`}
            >
              {pkg.featured && (
                <div className="mb-4">
                  <span
                    className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: "var(--brand-orange)",
                      color: "black",
                    }}
                  >
                    MOST POPULAR
                  </span>
                </div>
              )}

              <h3 className="text-2xl font-bold mb-2">{pkg.name}</h3>
              <div className="mb-1">
                <span className="text-4xl font-bold text-accent">
                  {pkg.price}
                </span>
                <span className="text-muted ml-2">/ month</span>
              </div>
              <p className="text-sm text-muted mb-6">
                {pkg.commission} commission | {pkg.maxProducts} products
              </p>

              <ul className="space-y-3 mb-8">
                {pkg.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-accent font-bold">✓</span>
                    <span className="text-muted text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleChoosePlan(pkg.name)}
                disabled={loading && selectedPlan === pkg.name}
                className={`w-full py-3 rounded font-bold transition ${
                  pkg.featured ? "btn-primary" : "btn-secondary"
                } disabled:opacity-50`}
              >
                {loading && selectedPlan === pkg.name ? "Processing..." : "Choose Plan"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Vendor Perks */}
      <section className="section-shell section-shell--tight">
        <h2 className="text-3xl font-bold mb-12 text-center text-accent">
          Vendor Perks
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {vendorPerks.map((perk, i) => (
            <div key={i} className="surface-card p-6">
              <h3 className="text-xl font-bold mb-3 text-accent">
                {perk.title}
              </h3>
              <p className="text-muted">{perk.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="section-shell section-shell--tight">
        <h2 className="text-3xl font-bold mb-12 text-center text-accent">
          Frequently Asked Questions
        </h2>
        <div className="space-y-6 max-w-4xl mx-auto">
          {faqItems.map((item, i) => (
            <div key={i} className="surface-card p-6">
              <h3 className="text-lg font-bold mb-3">{item.question}</h3>
              <p className="text-muted">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-shell section-shell--tight text-center">
        <div className="surface-card surface-card--raised p-10 max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-4 text-accent">
            Ready to Grow Your Business?
          </h2>
          <p className="text-muted mb-8">
            Join hundreds of vendors already selling on Good Hemp Distro.
          </p>
          <button
            onClick={() => handleChoosePlan("BASIC")}
            disabled={loading}
            className="btn-primary px-8 py-3 text-lg disabled:opacity-50"
          >
            {loading ? "Processing..." : "Get Started Today"}
          </button>
        </div>
      </section>
    </main>
    <Footer />
  </div>
  );
}
