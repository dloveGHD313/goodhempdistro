"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useSafeReducedMotion } from "@/lib/useSafeReducedMotion";
import { getQuestionsForRole } from "@/lib/onboarding/questions";
import { getDestinationForRoles } from "@/lib/onboarding/destination";
import { getConsumerUseType, isConsumerWholesaleChoice } from "@/lib/onboarding/answers";
import type { Question } from "@/lib/onboarding/questions";
import { logEvent } from "@/lib/telemetry/client";
import type { OnboardingRole } from "@/lib/onboarding/role";
import QuestionnaireCard from "./QuestionnaireCard";
import ProgressIndicator from "./ProgressIndicator";

export type OnboardingStepStatus = "idle" | "submitting" | "error" | "success";

type Props = {
  role: OnboardingRole;
  roles?: string[];
  /** When provided, use instead of getQuestionsForRole(role) for multi-role flow. */
  flatQuestions?: Question[];
  /** Optional seed answers (e.g. consumer_consumer_use_type when branching from get-started). */
  initialAnswers?: Record<string, string | string[]>;
  reducedMotion?: boolean;
  onStepStatusChange?: (stepIndex: number, totalSteps: number, status: OnboardingStepStatus) => void;
  /** If provided, called on success instead of redirecting. */
  onSuccessRedirect?: () => void;
};

const SUCCESS_DELAY_MS = 550;

export default function QuestionnaireFlow({
  role,
  roles: rolesProp,
  flatQuestions: flatQuestionsProp,
  initialAnswers: initialAnswersProp,
  reducedMotion: reducedMotionProp,
  onStepStatusChange,
  onSuccessRedirect,
}: Props) {
  const router = useRouter();
  const systemReduced = useSafeReducedMotion();
  const reducedMotion = reducedMotionProp ?? systemReduced ?? false;

  const questions =
    Array.isArray(flatQuestionsProp) && flatQuestionsProp.length > 0
      ? flatQuestionsProp
      : getQuestionsForRole(role);
  const totalSteps = questions.length;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(() => {
    const ia = initialAnswersProp;
    if (ia != null && typeof ia === "object" && !Array.isArray(ia) && Object.keys(ia).length > 0) {
      return { ...ia };
    }
    return {};
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [direction, setDirection] = useState(0);
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onStepStatusChangeRef = useRef<Props["onStepStatusChange"]>(onStepStatusChange);
  useEffect(() => {
    onStepStatusChangeRef.current = onStepStatusChange;
  }, [onStepStatusChange]);

  const emit = useCallback(
    (status: OnboardingStepStatus) => {
      onStepStatusChangeRef.current?.(step, totalSteps, status);
    },
    [step, totalSteps]
  );

  useEffect(() => {
    return () => {
      if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    emit("idle");
  }, [step, totalSteps, emit]);

  const currentQuestion = questions[step];
  const rawSelected = currentQuestion ? answers[currentQuestion.id] ?? null : null;
  const isMulti = !!currentQuestion?.multiSelect;
  const selected =
    rawSelected === null
      ? null
      : Array.isArray(rawSelected)
        ? rawSelected
        : [rawSelected];
  const canProceed = isMulti
    ? Array.isArray(selected) && selected.length > 0
    : selected !== null && (Array.isArray(selected) ? selected.length === 1 : true);
  const isLast = step === questions.length - 1;

  const handleSelect = useCallback(
    (value: string) => {
      if (!currentQuestion || submitting) return;
      setError(null);
      if (currentQuestion.multiSelect) {
        setAnswers((prev) => {
          const current = prev[currentQuestion.id];
          const arr = Array.isArray(current) ? current : current != null ? [current] : [];
          const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
          return { ...prev, [currentQuestion.id]: next };
        });
      } else {
        setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
      }
    },
    [currentQuestion, submitting]
  );

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
    navTimeoutRef.current = null;

    const driver_modeRaw =
      answers["driver_mode"] ?? answers["driver_driver_mode"];
    const driver_mode =
      typeof driver_modeRaw === "string" ? driver_modeRaw : undefined;

    emit("submitting");
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "1.5",
          role,
          roles: Array.isArray(rolesProp) && rolesProp.length > 0 ? rolesProp : [role],
          answers,
          driver_mode: driver_mode ?? null,
        }),
        credentials: "include",
      });

      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; role?: string };

      if (res.status === 401) {
        emit("error");
        setSubmitting(false);
        router.replace("/signup?next=" + encodeURIComponent("/get-started"));
        return;
      }

      if (res.ok && data.ok) {
        logEvent("onboarding_submit_success", { role, stepCount: questions.length });
        setSuccess(true);
        emit("success");
        if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current);
        navTimeoutRef.current = setTimeout(() => {
          if (onSuccessRedirect) {
            onSuccessRedirect();
          } else {
            const rolesForDest =
              Array.isArray(rolesProp) && rolesProp.length > 0
                ? [...rolesProp]
                : [role];
            const useType = getConsumerUseType(answers);
            if (
              isConsumerWholesaleChoice(useType) &&
              rolesForDest.includes("consumer") &&
              !rolesForDest.includes("wholesale")
            ) {
              rolesForDest.push("wholesale");
            }
            const dest = getDestinationForRoles(rolesForDest, answers);
            router.replace(dest);
          }
        }, SUCCESS_DELAY_MS);
      } else {
        emit("error");
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
  }, [submitting, role, rolesProp, answers, questions.length, router, emit, onSuccessRedirect]);

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
          selected={isMulti ? (Array.isArray(selected) ? selected : []) : (Array.isArray(selected) ? selected[0] ?? null : selected)}
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
