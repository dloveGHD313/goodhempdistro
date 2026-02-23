"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useSafeReducedMotion } from "@/lib/useSafeReducedMotion";
import type { OnboardingRole } from "@/lib/onboarding/role";
import type { Question } from "@/lib/onboarding/questions";
import type { OnboardingStepStatus } from "./QuestionnaireFlow";
import QuestionnaireFlow from "./QuestionnaireFlow";
import JaxOnboardingGuide from "./JaxOnboardingGuide";

type Props = {
  role: OnboardingRole;
  roles?: string[];
  flatQuestions?: Question[];
  onSuccessRedirect?: () => void;
};

/**
 * Phase 2: Wrapper with page entrance animation.
 * Defers motion and QuestionnaireFlow until after client mount to avoid SSR crash
 * when framer-motion useReducedMotion (matchMedia) runs without window.
 */
function OnboardingShellWithMotion({ role, roles, flatQuestions, onSuccessRedirect }: Props) {
  const reducedMotion = useSafeReducedMotion();
  const [stepStatus, setStepStatus] = useState({
    stepIndex: 0,
    totalSteps: 3,
    status: "idle" as OnboardingStepStatus,
  });

  const handleStepStatusChange = useCallback(
    (stepIndex: number, totalSteps: number, status: OnboardingStepStatus) => {
      setStepStatus((prev) => {
        if (
          prev.stepIndex === stepIndex &&
          prev.totalSteps === totalSteps &&
          prev.status === status
        )
          return prev;
        return { stepIndex, totalSteps, status };
      });
    },
    []
  );

  return (
    <div className="relative">
      <JaxOnboardingGuide
        stepIndex={stepStatus.stepIndex}
        totalSteps={stepStatus.totalSteps}
        status={stepStatus.status}
        reducedMotion={reducedMotion}
        position="top-left"
        showWatermark
      />
      <motion.div
        initial={reducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: reducedMotion ? 0.1 : 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 pt-20 md:pt-24 space-y-6"
      >
        <h1 className="text-2xl md:text-3xl font-bold text-accent mb-2 text-center max-w-2xl mx-auto">
          Let&apos;s tailor your experience
        </h1>
        <p className="text-muted text-center mb-8">
          Answer a few quick questions — no typing.
        </p>
        <QuestionnaireFlow
          role={role}
          roles={roles}
          flatQuestions={flatQuestions}
          reducedMotion={reducedMotion}
          onStepStatusChange={handleStepStatusChange}
          onSuccessRedirect={onSuccessRedirect}
        />
      </motion.div>
    </div>
  );
}

export default function OnboardingShell({ role, roles, flatQuestions, onSuccessRedirect }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-accent mb-2 text-center max-w-2xl mx-auto">
            Let&apos;s tailor your experience
          </h1>
          <p className="text-muted text-center mb-8">
            Answer a few quick questions — no typing.
          </p>
          <div className="max-w-2xl mx-auto flex justify-center py-12">
            <span className="text-muted">Loading…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <OnboardingShellWithMotion
      role={role}
      roles={roles}
      flatQuestions={flatQuestions}
      onSuccessRedirect={onSuccessRedirect}
    />
  );
}
