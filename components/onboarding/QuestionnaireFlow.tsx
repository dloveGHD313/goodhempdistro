"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { getQuestionsForRole } from "@/lib/onboarding/questions";
import { getDestinationForRole } from "@/lib/onboarding/destination";
import { logEvent } from "@/lib/telemetry/client";
import type { OnboardingRole } from "@/lib/onboarding/role";
import QuestionnaireCard from "./QuestionnaireCard";
import ProgressIndicator from "./ProgressIndicator";

export type OnboardingStepStatus = "idle" | "submitting" | "error" | "success";

type Props = {
  role: OnboardingRole;
  reducedMotion?: boolean;
  onStepStatusChange?: (stepIndex: number, totalSteps: number, status: OnboardingStepStatus) => void;
};

const SUCCESS_DELAY_MS = 550;

export default function QuestionnaireFlow({
  role,
  reducedMotion: reducedMotionProp,
  onStepStatusChange,
}: Props) {
  const router = useRouter();
  const systemReduced = useReducedMotion();
  const reducedMotion = reducedMotionProp ?? systemReduced ?? false;

  const questions = getQuestionsForRole(role);
  const totalSteps = questions.length;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [direction, setDirection] = useState(0);
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emit = (status: OnboardingStepStatus) =>
    onStepStatusChange?.(step, totalSteps, status);

  useEffect(() => {
    return () => {
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    onStepStatusChange?.(step, totalSteps, "idle");
  }, [step, totalSteps, onStepStatusChange]);

  const currentQuestion = questions[step];
  const selected = currentQuestion ? answers[currentQuestion.id] ?? null : null;
  const canProceed = selected !== null;
  const isLast = step === questions.length - 1;

  const handleSelect = useCallback(
    (value: string) => {
      if (!currentQuestion || submitting) return;
      setError(null);
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    },
    [currentQuestion, submitting]
  );

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    navTimeoutRef.current = null;

    const driver_mode =
      role === "driver" && answers["driver_mode"] ? answers["driver_mode"] : undefined;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "1.5",
          role,
          answers,
          driver_mode: driver_mode ?? null,
        }),
        credentials: "include",
      });

      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; role?: string };

      if (res.ok && data.ok) {
        logEvent("onboarding_submit_success", { role, stepCount: questions.length });
        setSuccess(true);
        emit("success");
        const dest = getDestinationForRole(role, driver_mode);
        if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
        navTimeoutRef.current = setTimeout(() => {
          router.replace(dest);
        }, SUCCESS_DELAY_MS);
      } else {
        const fallback = "We couldn't save your answers. Please try again.";
        const errMsg =
          typeof data?.error === "string" && data.error.trim().length > 0
            ? data.error
            : fallback;
        setError(errMsg);
        logEvent("onboarding_submit_failure", {
          route: "/api/onboarding/submit",
          status: res.status,
          error: errMsg,
        });
        console.error("[onboarding] submit failed", {
          route: "/api/onboarding/submit",
          status: res.status,
          error: errMsg,
        });
      }
    } catch (err) {
      emit("error");
      const errMsg = "We couldn't save your answers. Please try again.";
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
      setError(errMsg);
      logEvent("onboarding_submit_failure", {
        route: "/api/onboarding/submit",
        error: String(err),
      });
      console.error("[onboarding] submit error", { route: "/api/onboarding/submit", err });
    } finally {
      setSubmitting(false);
    }
  }, [submitting, role, answers, questions.length, router]);

  const handleNext = useCallback(() => {
    if (!canProceed || submitting) return;
    setError(null);
    if (isLast) {
      handleSubmit();
    } else {
      setDirection(1);
      setStep((s) => s + 1);
    }
  }, [canProceed, submitting, isLast, handleSubmit]);

  const handleBack = useCallback(() => {
    if (step === 0 || submitting) return;
    setError(null);
    setDirection(-1);
    setStep((s) => s - 1);
  }, [step, submitting]);

  if (success) {
    return (
      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        transition={{ duration: reducedMotion ? 0.1 : 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-2xl mx-auto surface-card p-12 text-center"
      >
        {reducedMotion ? (
          <span className="text-5xl mb-4 block">✓</span>
        ) : (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
            className="text-5xl mb-4"
          >
            ✓
          </motion.div>
        )}
        <h2 className="text-2xl font-bold text-accent mb-2">All set!</h2>
        <p className="text-muted">Taking you to your next step…</p>
        <div className="mt-6 flex justify-center">
          <div className="h-1 w-32 rounded-full bg-[var(--surface)] overflow-hidden">
            <motion.div
              className="h-full bg-[var(--brand-lime)]"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: SUCCESS_DELAY_MS / 1000, ease: "linear" }}
            />
          </div>
        </div>
      </motion.div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="space-y-6">
      <ProgressIndicator current={step} total={questions.length} reducedMotion={reducedMotion} />

      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <QuestionnaireCard
          key={currentQuestion.id}
          question={currentQuestion}
          selected={selected}
          onSelect={handleSelect}
          stepIndex={step}
          disabled={submitting}
          error={error}
          reducedMotion={reducedMotion}
          direction={direction}
        />
      </AnimatePresence>

      <div className="max-w-2xl mx-auto flex gap-3 justify-between items-center">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 0 || submitting}
          aria-busy={submitting}
          className={`btn-secondary motion-medium ${step === 0 || submitting ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          Back
        </button>
        <div className="flex gap-3 items-center">
          {error && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                handleSubmit();
              }}
              disabled={submitting}
              className="btn-secondary text-sm"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed || submitting}
            aria-busy={submitting}
            className={`btn-primary motion-medium flex items-center gap-2 ${!canProceed || submitting ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {submitting ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Saving…
              </>
            ) : isLast ? (
              "Continue"
            ) : (
              "Next"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
