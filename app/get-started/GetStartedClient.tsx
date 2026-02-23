"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import Footer from "@/components/Footer";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import { getReferralCode } from "@/lib/referral";
import type { OnboardingRole } from "@/lib/onboarding/role";

const ROLE_OPTIONS: { id: OnboardingRole; label: string; icon: string }[] = [
  { id: "consumer", label: "Consumer / Shopper", icon: "🛍️" },
  { id: "vendor", label: "Vendor", icon: "🏪" },
  { id: "driver", label: "Driver / Logistics", icon: "🚚" },
  { id: "affiliate", label: "Affiliate", icon: "💰" },
  { id: "builder", label: "Builder / Contractor", icon: "🏗️" },
  { id: "educator", label: "Educator / Learning", icon: "🎓" },
  { id: "industrial", label: "Industrial / Wholesale", icon: "🏢" },
];

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

type View = "loading" | "role-select" | "questionnaire" | "plans";

export default function GetStartedClient() {
  const [view, setView] = useState<View>("loading");
  const [selectedRoles, setSelectedRoles] = useState<OnboardingRole[]>([]);
  const [primaryRole, setPrimaryRole] = useState<OnboardingRole>("consumer");
  const [plans, setPlans] = useState<ConsumerPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [missingEnv, setMissingEnv] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/status", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as { completed?: boolean };
        if (cancelled) return;
        if (data.completed) {
          setView("plans");
        } else {
          setView("role-select");
        }
      } catch {
        if (!cancelled) setView("role-select");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (view !== "plans") return;
    let cancelled = false;
    (async () => {
      setPlansLoading(true);
      try {
        const response = await fetch("/api/pricing/consumer-plans", { cache: "no-store" });
        const payload = await response.json();
        if (cancelled) return;
        if (response.ok) {
          setPlans(payload.plans || []);
          setPlansError(null);
          setMissingEnv([]);
        } else {
          setPlans([]);
          setPlansError(payload?.error || "Consumer packages are unavailable right now.");
          setMissingEnv(payload?.missingEnv || []);
          try {
            const statusResponse = await fetch("/api/consumer/status", { cache: "no-store" });
            if (statusResponse.ok) {
              const statusPayload = await statusResponse.json();
              setIsAdmin(Boolean(statusPayload?.isAdmin));
            }
          } catch {
            // ignore
          }
        }
      } catch {
        if (!cancelled) {
          setPlans([]);
          setPlansError("Consumer packages are unavailable right now.");
        }
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [view]);

  const handleRoleToggle = (id: OnboardingRole) => {
    setSelectedRoles((prev) => {
      const next = prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id];
      if (next.length === 0) return prev;
      return next;
    });
  };

  const handleRoleSelectNext = () => {
    if (selectedRoles.length === 0) return;
    setPrimaryRole(selectedRoles[0]);
    setView("questionnaire");
  };

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
    } catch {
      alert("Failed to start checkout. Please try again.");
    }
  };

  const hasConsumer = selectedRoles.includes("consumer");
  const onSuccessRedirect = hasConsumer ? () => setView("plans") : undefined;

  if (view === "loading") {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1 flex items-center justify-center section-shell">
          <div className="surface-card p-8 text-center max-w-md">
            <p className="text-muted">Loading…</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (view === "role-select") {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1 section-shell">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl mx-auto"
          >
            <h1 className="text-2xl md:text-3xl font-bold text-accent mb-2 text-center">
              What brings you here?
            </h1>
            <p className="text-muted text-center mb-8">
              Select all that apply — we&apos;ll tailor your experience.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleRoleToggle(opt.id)}
                  className={`surface-card p-4 text-left rounded-xl border-2 transition-colors flex items-start gap-3 ${
                    selectedRoles.includes(opt.id)
                      ? "border-[var(--brand-lime)] bg-[var(--surface)]/80"
                      : "border-[var(--border)] hover:border-[var(--brand-lime)]/50"
                  }`}
                >
                  <span className="text-2xl shrink-0">{opt.icon}</span>
                  <span className="font-medium">{opt.label}</span>
                  {selectedRoles.includes(opt.id) && (
                    <span className="ml-auto text-accent" aria-hidden>✓</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleRoleSelectNext}
                disabled={selectedRoles.length === 0}
                className="btn-primary px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  if (view === "questionnaire") {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <OnboardingShell
              role={primaryRole}
              roles={selectedRoles}
              onSuccessRedirect={onSuccessRedirect}
            />
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  // view === "plans"
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
            {(plansLoading ? [] : plans).map((plan) => (
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
          {!plansLoading && plans.length === 0 && (
            <div className="surface-card p-6 text-center text-muted">
              {plansError || "Consumer packages are unavailable right now. Please check back soon."}
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
