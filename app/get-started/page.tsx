"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Footer from "@/components/Footer";
import { getReferralCode } from "@/lib/referral";

type ConsumerPlan = {
  planKey: string;
  displayName: string;
  priceText: string;
  imageUrl: string;
  imageAlt: string;
  cadence: "monthly" | "annual";
  billingInterval: "month" | "year";
  bullets: string[];
};

export default function GetStartedPage() {
  const [plans, setPlans] = useState<ConsumerPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingEnv, setMissingEnv] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await fetch("/api/pricing/consumer-plans", {
          cache: "no-store",
        });
        const payload = await response.json();
        if (response.ok) {
          setPlans(payload.plans || []);
          setError(null);
          setMissingEnv([]);
        } else {
          setPlans([]);
          setError(payload?.error || "Consumer packages are unavailable right now.");
          setMissingEnv(payload?.missingEnv || []);
          try {
            const statusResponse = await fetch("/api/consumer/status", {
              cache: "no-store",
            });
            if (statusResponse.ok) {
              const statusPayload = await statusResponse.json();
              setIsAdmin(Boolean(statusPayload?.isAdmin));
            }
          } catch (statusError) {
            console.warn("[get-started] consumer status check failed", statusError);
          }
        }
      } catch (loadError) {
        console.error("Error loading consumer plans:", loadError);
        setPlans([]);
        setError("Consumer packages are unavailable right now.");
      } finally {
        setLoading(false);
      }
    };

    loadPlans();
  }, []);

  const handleSubscribe = async (planKey: string) => {
    const affiliateCode = getReferralCode();
    try {
      const response = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey, affiliateCode: affiliateCode || undefined }),
      });
      const payload = await response.json();
      if (response.status === 401) {
        window.location.href = "/login?redirect=/pricing?tab=consumer";
        return;
      }
      if (!response.ok) {
        alert(payload?.error || "Failed to start checkout.");
        return;
      }
      if (payload?.url) {
        window.location.href = payload.url;
      }
    } catch (checkoutError) {
      console.error("Error starting checkout:", checkoutError);
      alert("Failed to start checkout. Please try again.");
    }
  };

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-3xl mx-auto surface-card p-8 text-center">
            <h1 className="text-4xl font-bold mb-4 text-accent">Get Started</h1>
            <p className="text-muted mb-8">Create an account to access the full community and marketplace.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login" className="btn-secondary">Login</Link>
              <Link href="/signup" className="btn-primary">Sign Up</Link>
            </div>
          </div>
        </section>

        <section className="section-shell section-shell--tight">
          <h2 className="text-3xl font-bold mb-10 text-center text-accent">
            Choose a Consumer Package
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {(loading ? [] : plans).map((plan) => (
              <div key={plan.planKey} className="surface-card p-6 text-center">
                <div className="mb-4 overflow-hidden rounded-xl">
                  <Image
                    src={plan.imageUrl}
                    alt={plan.imageAlt || `${plan.displayName} plan`}
                    width={640}
                    height={360}
                    className="h-40 w-full object-cover"
                  />
                </div>
                <h3 className="text-xl font-bold mb-2">{plan.displayName}</h3>
                <p className="text-3xl font-bold text-accent mb-3">{plan.priceText}</p>
                <ul className="text-sm text-muted mb-6 text-left space-y-2">
                  {(plan.bullets || []).map((bullet, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-accent">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => handleSubscribe(plan.planKey)}
                  className="btn-primary w-full"
                >
                  Subscribe
                </button>
              </div>
            ))}
          </div>
          {!loading && plans.length === 0 && (
            <div className="surface-card p-6 text-center text-muted">
              {error || "Consumer packages are unavailable right now. Please check back soon."}
              {isAdmin && missingEnv.length > 0 && (
                <p className="text-xs text-yellow-200 mt-2">
                  Missing env: {missingEnv.join(", ")}
                </p>
              )}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
