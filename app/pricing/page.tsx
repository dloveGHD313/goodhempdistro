"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { getReferralCode } from "@/lib/referral";
import Footer from "@/components/Footer";

type VendorPlan = {
  key: string;
  tier: string;
  cadence: "monthly" | "annual";
  interval: "month" | "year";
  priceId: string;
  displayName: string;
  priceDisplay: string;
  commission: number;
  productLimit: number | null;
  features: string[];
};

type ConsumerPlan = {
  id: string;
  name: string;
  price_cents: number;
  monthly_points: number;
  perks_json: string[];
};

export default function PricingPage() {
  const router = useRouter();
  const [consumerPlans, setConsumerPlans] = useState<ConsumerPlan[]>([]);
  const [vendorPlans, setVendorPlans] = useState<VendorPlan[]>([]);
  const [vendorPlansReady, setVendorPlansReady] = useState(false);
  const [vendorPlansMissing, setVendorPlansMissing] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"vendor" | "consumer">("consumer");

  useEffect(() => {
    async function loadPlans() {
      const supabase = createSupabaseBrowserClient();

      // Load consumer plans
      const { data: cp } = await supabase
        .from("consumer_plans")
        .select("id, name, price_cents, monthly_points, perks_json")
        .eq("is_active", true)
        .order("price_cents", { ascending: true });

      setConsumerPlans((cp || []) as ConsumerPlan[]);
      setLoading(false);
    }

    loadPlans();
  }, []);

  useEffect(() => {
    async function loadVendorPlans() {
      try {
        const response = await fetch("/api/pricing/vendor-plans", {
          cache: "no-store",
        });
        const payload = await response.json();
        if (response.ok) {
          setVendorPlans(payload.plans || []);
          setVendorPlansMissing(payload.missingEnv || []);
        }
      } catch (error) {
        console.error("[pricing] failed to load vendor plans", error);
      } finally {
        setVendorPlansReady(true);
      }
    }

    loadVendorPlans();
  }, []);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const hasVendorPlans = vendorPlansReady && vendorPlans.length > 0;

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && vendorPlansMissing.length > 0) {
      console.warn("[pricing] missing vendor plan env vars", vendorPlansMissing);
    }
  }, [vendorPlansMissing]);

  const handleSubscribe = async (planType: "vendor" | "consumer", planName: string) => {
    const affiliateCode = getReferralCode();
    
    try {
      const endpoint =
        planType === "vendor"
          ? "/api/stripe/checkout"
          : "/api/subscriptions/checkout";
      const payload =
        planType === "vendor"
          ? { priceId: planName }
          : { planType, planName, affiliateCode: affiliateCode || undefined };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to create checkout session");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error starting checkout:", error);
      alert("Failed to start checkout. Please try again.");
    }
  };

  const startVendorCheckout = async (plan: VendorPlan) => {
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: plan.priceId,
          planKey: plan.key,
          tier: plan.tier,
          cadence: plan.cadence,
          productLimit: plan.productLimit,
          commission: plan.commission,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        alert(data.error || "Failed to create checkout session");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error starting vendor checkout:", error);
      alert("Failed to start checkout. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <h1 className="text-4xl font-bold mb-6 text-accent">Pricing</h1>
            <p className="text-muted">Loading plans...</p>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-6 text-accent">Pricing Plans</h1>
          <p className="text-muted mb-12">Choose the plan that's right for you</p>

          <div className="mb-8 flex gap-4 justify-center">
            <button
              onClick={() => setActiveTab("consumer")}
              className={`px-6 py-3 rounded-lg font-semibold transition ${
                activeTab === "consumer"
                  ? "bg-accent text-white"
                  : "bg-[var(--surface)] text-muted hover:bg-[var(--surface)]/80"
              }`}
            >
              Consumer Plans
            </button>
            <button
              onClick={() => setActiveTab("vendor")}
              className={`px-6 py-3 rounded-lg font-semibold transition ${
                activeTab === "vendor"
                  ? "bg-accent text-white"
                  : "bg-[var(--surface)] text-muted hover:bg-[var(--surface)]/80"
              }`}
            >
              Vendor Plans
            </button>
          </div>

          {activeTab === "consumer" && (
            <div className="grid gap-6 md:grid-cols-3">
              {consumerPlans.map((plan) => (
                <div key={plan.id} className="card-glass p-6 text-center">
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-4xl font-bold text-accent mb-4">
                    {formatPrice(plan.price_cents)}<span className="text-lg text-muted">/mo</span>
                  </p>
                  <p className="text-sm text-muted mb-4">
                    {plan.monthly_points} points/month
                  </p>
                  <ul className="space-y-2 text-left mb-6 min-h-[150px]">
                    {(plan.perks_json || []).map((perk, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-accent">✓</span>
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleSubscribe("consumer", plan.name)}
                    className="btn-primary w-full"
                  >
                    Subscribe
                  </button>
                </div>
              ))}
              {consumerPlans.length === 0 && (
                <div className="col-span-3 card-glass p-6 text-center text-muted">
                  Consumer plans coming soon.
                </div>
              )}
            </div>
          )}

          {activeTab === "vendor" && (
            <div className="grid gap-6 md:grid-cols-3">
              {vendorPlans.map((plan) => (
                <div key={plan.key} className="card-glass p-6 text-center">
                  <h3 className="text-2xl font-bold mb-2">{plan.displayName}</h3>
                  <p className="text-4xl font-bold text-accent mb-4">
                    {plan.priceDisplay}
                  </p>
                  <p className="text-sm text-muted mb-4">
                    {plan.commission}% commission
                  </p>
                  <ul className="space-y-2 text-left mb-6 min-h-[150px]">
                    <li className="flex items-start gap-2 text-sm">
                      <span className="text-accent">✓</span>
                      <span>
                        {plan.productLimit ? `${plan.productLimit} products` : "Unlimited products"}
                      </span>
                    </li>
                    {(plan.features || []).map((perk, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-accent">✓</span>
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => startVendorCheckout(plan)}
                    className="btn-primary w-full"
                  >
                    Start checkout
                  </button>
                </div>
              ))}
              {!hasVendorPlans && (
                <div className="col-span-3 card-glass p-6 text-center text-muted">
                  Vendor plans coming soon.
                </div>
              )}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
