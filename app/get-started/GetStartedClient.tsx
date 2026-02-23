"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Footer from "@/components/Footer";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import { getQuestionsForRole } from "@/lib/onboarding/questions";
import type { OnboardingRole } from "@/lib/onboarding/role";
import type { Question } from "@/lib/onboarding/questions";

// Events last per CEO vision; order otherwise: consumer, vendor, affiliate, driver, builder, educator, industrial, events
const ROLE_OPTIONS: { id: OnboardingRole; label: string; icon: string }[] = [
  { id: "consumer", label: "Consumer / Shopper", icon: "🛍️" },
  { id: "vendor", label: "Vendor", icon: "🏪" },
  { id: "affiliate", label: "Affiliate", icon: "💰" },
  { id: "driver", label: "Driver / Logistics", icon: "🚚" },
  { id: "builder", label: "Builder / Contractor", icon: "🏗️" },
  { id: "educator", label: "Educator / Learning", icon: "🎓" },
  { id: "industrial", label: "Industrial / Wholesale", icon: "🏢" },
  { id: "events", label: "Events", icon: "🎪" },
];

type View = "loading" | "role-select" | "questionnaire";

export default function GetStartedClient() {
  const router = useRouter();
  const [view, setView] = useState<View>("loading");
  const [selectedRoles, setSelectedRoles] = useState<OnboardingRole[]>([]);
  const [primaryRole, setPrimaryRole] = useState<OnboardingRole>("consumer");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding/status", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as { completed?: boolean; authenticated?: boolean };
        if (cancelled) return;
        if (data.completed) {
          router.replace("/newsfeed");
          return;
        }
        setView("role-select");
      } catch {
        if (!cancelled) setView("role-select");
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const handleRoleToggle = (id: OnboardingRole) => {
    setSelectedRoles((prev) => {
      const next = prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id];
      if (next.length === 0) return prev;
      return next;
    });
  };

  const handleRoleSelectNext = async () => {
    if (selectedRoles.length === 0) return;
    try {
      const res = await fetch("/api/onboarding/status", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { authenticated?: boolean };
      if (data.authenticated !== true) {
        window.location.href = "/signup?next=/get-started";
        return;
      }
    } catch {
      window.location.href = "/signup?next=/get-started";
      return;
    }
    setPrimaryRole(selectedRoles[0]);
    setView("questionnaire");
  };

  const flatQuestions = useMemo((): Question[] => {
    return selectedRoles.flatMap((role) =>
      getQuestionsForRole(role).map((q) => ({ ...q, id: `${role}_${q.id}` }))
    );
  }, [selectedRoles]);

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
              flatQuestions={flatQuestions}
            />
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return null;
}
