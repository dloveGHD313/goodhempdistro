"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getReferralCode } from "@/lib/referral";
import Footer from "@/components/Footer";

type VendorPlan = {
  key: string;
  planKey: string;
  tier: string;
  billingCycle: "monthly" | "annual";
  interval: "month" | "year";
  priceId: string;
  displayName: string;
  headlinePriceText: string;
  subPriceNote?: string;
  commissionText: string;
  commissionPercent: number;
  productLimitText: string;
  productLimit: number | null;
  includedBullets: string[];
  limitationBullets: string[];
  imageUrl: string;
  imageAlt: string;
};

type ConsumerPlan = {
  planKey: string;
  tier: string;
  cadence: "monthly" | "annual";
  billingInterval: "month" | "year";
  priceId: string;
  displayName: string;
  priceText: string;
  loyaltyMultiplier: number;
  referralRewardPoints: number;
  imageUrl: string;
  imageAlt: string;
  description: string;
};

export default function PricingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [consumerPlans, setConsumerPlans] = useState<ConsumerPlan[]>([]);
  const [consumerError, setConsumerError] = useState<string | null>(null);
  const [consumerMissingEnv, setConsumerMissingEnv] = useState<string[]>([]);
  const [consumerIsAdmin, setConsumerIsAdmin] = useState(false);
  const [vendorPlans, setVendorPlans] = useState<VendorPlan[]>([]);
  const [vendorPlansReady, setVendorPlansReady] = useState(false);
  const [vendorPlansMissing, setVendorPlansMissing] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"vendor" | "consumer">("consumer");

  useEffect(() => {
    async function loadPlans() {
      try {
        const response = await fetch("/api/pricing/consumer-plans", {
          cache: "no-store",
        });
        const payload = await response.json();
        if (response.ok) {
          setConsumerPlans(payload.plans || []);
          setConsumerError(null);
          setConsumerMissingEnv([]);
        } else {
          setConsumerPlans([]);
          setConsumerError(payload?.error || "Consumer plans are unavailable.");
          setConsumerMissingEnv(payload?.missingEnv || []);
          try {
            const statusResponse = await fetch("/api/consumer/status", {
              cache: "no-store",
            });
            if (statusResponse.ok) {
              const statusPayload = await statusResponse.json();
              setConsumerIsAdmin(Boolean(statusPayload?.isAdmin));
            }
          } catch (statusError) {
            console.warn("[pricing] consumer status check failed", statusError);
          }
        }
      } catch (error) {
        console.error("[pricing] failed to load consumer plans", error);
        setConsumerPlans([]);
        setConsumerError("Consumer plans are unavailable.");
      } finally {
        setLoading(false);
      }
    }

    loadPlans();
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "vendor" || tab === "consumer") {
      setActiveTab(tab);
    }
  }, [searchParams]);

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

  const hasVendorPlans = vendorPlansReady && vendorPlans.length > 0;

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && vendorPlansMissing.length > 0) {
      console.warn("[pricing] missing vendor plan env vars", vendorPlansMissing);
    }
  }, [vendorPlansMissing]);

  const handleSubscribe = async (planType: "vendor" | "consumer", planKey: string) => {
    const affiliateCode = getReferralCode();
    
    try {
      const endpoint =
        planType === "vendor"
          ? "/api/stripe/checkout"
          : "/api/subscriptions/checkout";
      const payload =
        planType === "vendor"
          ? { priceId: planKey }
          : { planKey, affiliateCode: affiliateCode || undefined };
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
          planKey: plan.planKey,
          tier: plan.tier,
          cadence: plan.billingCycle,
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
                <div key={plan.planKey} className="card-glass p-6 text-center">
                  <div className="mb-4 overflow-hidden rounded-xl">
                    <Image
                      src={plan.imageUrl}
                      alt={plan.imageAlt || `${plan.displayName} plan`}
                      width={640}
                      height={360}
                      className="h-40 w-full object-cover"
                    />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{plan.displayName}</h3>
                  <p className="text-4xl font-bold text-accent mb-4">
                    {plan.priceText}
                  </p>
                  <p className="text-sm text-muted mb-6 text-left min-h-[120px]">
                    {plan.description}
                  </p>
                  <button
                    onClick={() => handleSubscribe("consumer", plan.planKey)}
                    className="btn-primary w-full"
                  >
                    Subscribe
                  </button>
                </div>
              ))}
              {consumerPlans.length === 0 && (
                <div className="col-span-3 card-glass p-6 text-center text-muted">
                  {consumerError || "Consumer plans are unavailable right now. Please check back soon."}
                  {consumerIsAdmin && consumerMissingEnv.length > 0 && (
                    <p className="text-xs text-yellow-200 mt-2">
                      Missing env: {consumerMissingEnv.join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "vendor" && (
            <div className="grid gap-6 md:grid-cols-3">
              {vendorPlans.map((plan) => (
                <div key={plan.key} className="card-glass p-6 text-left">
                  <div className="mb-4 overflow-hidden rounded-xl">
                    <Image
                      src={plan.imageUrl}
                      alt={plan.imageAlt || `${plan.displayName} plan`}
                      width={640}
                      height={360}
                      className="h-40 w-full object-cover"
                    />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{plan.displayName}</h3>
                  <p className="text-4xl font-bold text-accent mb-2">
                    {plan.headlinePriceText}
                  </p>
                  {plan.subPriceNote && (
                    <p className="text-sm text-muted mb-4">{plan.subPriceNote}</p>
                  )}
                  <div className="text-sm text-muted mb-4 space-y-1">
                    <p>{plan.commissionText}</p>
                    <p>{plan.productLimitText}</p>
                  </div>
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-white mb-2">What&apos;s included</p>
                    <ul className="space-y-2 text-left">
                      {(plan.includedBullets || []).map((perk, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-accent">✓</span>
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {plan.limitationBullets?.length > 0 && (
                    <div className="mb-6">
                      <p className="text-sm font-semibold text-white mb-2">Limitations</p>
                      <ul className="space-y-2 text-left">
                        {plan.limitationBullets.map((limitation, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <span className="text-orange-300">•</span>
                            <span>{limitation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
