"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Footer from "@/components/Footer";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import {
  getQuestionsForRole,
  getConsumerFollowUpQuestions,
  CONSUMER_USE_TYPE_QUESTION,
} from "@/lib/onboarding/questions";
import type { OnboardingRole } from "@/lib/onboarding/role";
import type { Question } from "@/lib/onboarding/questions";
import { US_STATES, isValidOnboardingState } from "@/lib/onboarding/us-states";
import { getDestinationForRoles } from "@/lib/onboarding/destination";
import { getConsumerUseType, isConsumerWholesaleChoice } from "@/lib/onboarding/answers";
import type { OnboardingCompletePayload } from "@/components/onboarding/QuestionnaireFlow";

// CEO-locked role list. `key` is a unique button identifier; `role` is the OnboardingRole value.
// Multiple cards can share a role (e.g. industrial) without cross-toggling each other.
const ROLE_OPTIONS = [
  { key: "consumer",           role: "consumer"  as OnboardingRole, label: "Consumer / Shopper",    icon: "🛍️" },
  { key: "vendor",             role: "vendor"    as OnboardingRole, label: "Vendor / Seller",        icon: "🏪" },
  { key: "affiliate",          role: "affiliate" as OnboardingRole, label: "Affiliate / Referral",   icon: "💰" },
  { key: "driver",             role: "driver"    as OnboardingRole, label: "Driver / Delivery",      icon: "🚚" },
  { key: "builder",            role: "builder"   as OnboardingRole, label: "Builder / Contractor",   icon: "🏗️" },
  { key: "educator",           role: "educator"  as OnboardingRole, label: "Education / Learning",   icon: "🎓" },
  { key: "industrial_creator", role: "industrial" as OnboardingRole, label: "Creator / Content",    icon: "🎬" },
  { key: "industrial_service", role: "industrial" as OnboardingRole, label: "Service Provider",     icon: "🛠️" },
  { key: "industrial",        role: "industrial"  as OnboardingRole, label: "Industrial / Wholesale", icon: "🏢" },
  { key: "events",             role: "events"    as OnboardingRole, label: "Events",                icon: "🎪" },
] as const;

// Map a ?role= query value (hyphenated card key OR bare role value) to one card key.
// Example mapping: "industrial-creator" → "industrial_creator", "vendor" → "vendor".
function resolveRoleParamToCardKey(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase().replace(/-/g, "_");
  if (!normalized) return null;
  const exact = ROLE_OPTIONS.find((o) => o.key === normalized);
  if (exact) return exact.key;
  const byRole = ROLE_OPTIONS.find((o) => o.role === normalized);
  return byRole ? byRole.key : null;
}

type View = "loading" | "role-select" | "consumer-use-type" | "questionnaire" | "state-picker";

export default function GetStartedClient() {
  const router = useRouter();
  const [view, setView] = useState<View>("loading");
  // selectedRoleKeys tracks which *cards* are toggled (unique per button, not per role value).
  const [selectedRoleKeys, setSelectedRoleKeys] = useState<string[]>([]);
  const [primaryRole, setPrimaryRole] = useState<OnboardingRole>("consumer");
  const [consumerUseType, setConsumerUseType] = useState<"personal" | "business">("personal");
  const [pendingPayload, setPendingPayload] = useState<OnboardingCompletePayload | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [stateSubmitting, setStateSubmitting] = useState(false);
  const [stateError, setStateError] = useState<string | null>(null);

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

        // Pre-check role card from ?role= query param. Synchronous on first render of role-select.
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const cardKey = resolveRoleParamToCardKey(params.get("role"));
          if (cardKey) setSelectedRoleKeys([cardKey]);
        }

        setView("role-select");
      } catch {
        if (!cancelled) setView("role-select");
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  const selectedRoles = useMemo((): OnboardingRole[] =>
    Array.from(
      new Set(
        selectedRoleKeys
          .map((k) => ROLE_OPTIONS.find((o) => o.key === k)?.role)
          .filter((r): r is OnboardingRole => r !== undefined)
      )
    ),
  [selectedRoleKeys]
  );

  const handleRoleToggle = (key: string) => {
    setSelectedRoleKeys((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      if (next.length === 0) return prev;
      return next;
    });
  };

  const handleRoleSelectNext = async () => {
    if (selectedRoleKeys.length === 0) return;
    try {
      const res = await fetch("/api/onboarding/status", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { authenticated?: boolean };
      if (data.authenticated !== true) {
        // Preserve the selected role through signup so it pre-checks again on return.
        const firstKey = selectedRoleKeys[0].replace(/_/g, "-");
        const next = `/get-started?role=${encodeURIComponent(firstKey)}`;
        window.location.href = `/signup?next=${encodeURIComponent(next)}`;
        return;
      }
    } catch {
      const firstKey = selectedRoleKeys[0].replace(/_/g, "-");
      const next = `/get-started?role=${encodeURIComponent(firstKey)}`;
      window.location.href = `/signup?next=${encodeURIComponent(next)}`;
      return;
    }
    setPrimaryRole(selectedRoles[0]);
    if (selectedRoles.length === 1 && selectedRoles[0] === "consumer") {
      setView("consumer-use-type");
      return;
    }
    setView("questionnaire");
  };

  const flatQuestions = useMemo((): Question[] => {
    if (view === "questionnaire" && primaryRole === "consumer" && selectedRoles.length === 1) {
      const followUp = getConsumerFollowUpQuestions(consumerUseType);
      return followUp.map((q) => ({ ...q, id: `consumer_${q.id}` }));
    }
    return selectedRoles.flatMap((role) =>
      getQuestionsForRole(role).map((q) => ({ ...q, id: `${role}_${q.id}` }))
    );
  }, [selectedRoles, primaryRole, view, consumerUseType]);

  const handleQuestionnaireComplete = (payload: OnboardingCompletePayload) => {
    setPendingPayload(payload);
    setStateError(null);
    setView("state-picker");
  };

  const submitWithState = async (stateValue: string) => {
    if (!pendingPayload || stateSubmitting) return;
    setStateSubmitting(true);
    setStateError(null);

    try {
      const rolesToSend = selectedRoles.length > 0 ? selectedRoles : [primaryRole];
      const res = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "1.5",
          role: rolesToSend[0],
          roles: rolesToSend,
          answers: pendingPayload.answers,
          driver_mode: pendingPayload.driver_mode ?? null,
          onboarding_state: stateValue,
        }),
        credentials: "include",
      });

      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (res.status === 401) {
        router.replace("/signup?next=" + encodeURIComponent("/get-started"));
        return;
      }

      if (res.ok && data.ok) {
        const rolesForDest = [...rolesToSend.map(String)];
        const useType = getConsumerUseType(pendingPayload.answers);
        if (
          isConsumerWholesaleChoice(useType) &&
          rolesForDest.includes("consumer") &&
          !rolesForDest.includes("wholesale")
        ) {
          rolesForDest.push("wholesale");
        }
        const dest = getDestinationForRoles(rolesForDest, pendingPayload.answers);
        router.replace(dest);
        return;
      }

      const fallback = "We couldn't save your answers. Please try again.";
      const errMsg = typeof data?.error === "string" && data.error.trim() ? data.error : fallback;
      setStateError(errMsg);
    } catch {
      setStateError("We couldn't save your answers. Please try again.");
    } finally {
      setStateSubmitting(false);
    }
  };

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
                  key={opt.key}
                  type="button"
                  onClick={() => handleRoleToggle(opt.key)}
                  className={`surface-card p-4 text-left rounded-xl border-2 transition-colors flex items-start gap-3 ${
                    selectedRoleKeys.includes(opt.key)
                      ? "border-[var(--brand-lime)] bg-[var(--surface)]/80"
                      : "border-[var(--border)] hover:border-[var(--brand-lime)]/50"
                  }`}
                >
                  <span className="text-2xl shrink-0">{opt.icon}</span>
                  <span className="font-medium">{opt.label}</span>
                  {selectedRoleKeys.includes(opt.key) && (
                    <span className="ml-auto text-accent" aria-hidden>✓</span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleRoleSelectNext}
                disabled={selectedRoleKeys.length === 0}
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

  if (view === "consumer-use-type") {
    const useTypeQuestion = { ...CONSUMER_USE_TYPE_QUESTION, id: "consumer_consumer_use_type" };
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
              {useTypeQuestion.prompt}
            </h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 mb-8">
              {useTypeQuestion.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setConsumerUseType(opt.value === "business" ? "business" : "personal")}
                  className={`surface-card p-4 text-left rounded-xl border-2 transition-colors ${
                    (opt.value === "business" && consumerUseType === "business") ||
                    (opt.value === "personal" && consumerUseType === "personal")
                      ? "border-[var(--brand-lime)] bg-[var(--surface)]/80"
                      : "border-[var(--border)] hover:border-[var(--brand-lime)]/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setView("questionnaire");
                }}
                className="btn-primary px-8 py-3"
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
    const initialAnswers =
      primaryRole === "consumer" && selectedRoles.length === 1
        ? { consumer_consumer_use_type: consumerUseType }
        : undefined;
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <OnboardingShell
              role={primaryRole}
              roles={selectedRoles}
              flatQuestions={flatQuestions}
              initialAnswers={initialAnswers}
              onCompleteIntercept={handleQuestionnaireComplete}
            />
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  if (view === "state-picker") {
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
              Where are you located?
            </h1>
            <p className="text-muted text-center mb-8">
              Helps us show relevant products and comply with state laws.
            </p>

            <label htmlFor="onboarding-state" className="sr-only">
              Select state
            </label>
            <select
              id="onboarding-state"
              value={selectedState ?? ""}
              onChange={(e) => {
                setStateError(null);
                const v = e.target.value;
                setSelectedState(isValidOnboardingState(v) ? v : null);
              }}
              disabled={stateSubmitting}
              className="w-full surface-card p-4 rounded-xl border-2 border-[var(--border)] focus:border-[var(--brand-lime)] outline-none mb-6 bg-transparent"
            >
              <option value="" disabled>
                Choose a state…
              </option>
              {US_STATES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            {stateError && (
              <p className="text-sm text-red-400 mb-4 text-center" role="alert">
                {stateError}
              </p>
            )}

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => selectedState && submitWithState(selectedState)}
                disabled={!selectedState || stateSubmitting}
                aria-busy={stateSubmitting}
                className="btn-primary px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {stateSubmitting ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving…
                  </>
                ) : (
                  "Finish"
                )}
              </button>
            </div>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  return null;
}
