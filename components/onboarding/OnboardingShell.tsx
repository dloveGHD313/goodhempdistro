"use client";

import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { OnboardingRole } from "@/lib/onboarding/role";
import QuestionnaireFlow from "./QuestionnaireFlow";
import JaxOnboardingGuide from "./JaxOnboardingGuide";

type Props = {
  role: OnboardingRole;
};

/**
 * Phase 2: Wrapper with page entrance animation.
 * Defers motion and QuestionnaireFlow until after client mount to avoid SSR crash
 * when framer-motion useReducedMotion (matchMedia) runs without window.
 */
function OnboardingShellWithMotion({ role }: Props) {
  const reducedMotion = useReducedMotion() ?? false;
  const [stepStatus, setStepStatus] = useState({
    stepIndex: 0,
    totalSteps: 3,
    status: "idle" as "idle" | "submitting" | "error" | "success",
  });

  return (
    <motion.div
      initial={reducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reducedMotion ? 0.1 : 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-accent mb-2 text-center max-w-2xl mx-auto">
          Let&apos;s tailor your experience
        </h1>
        <p className="text-muted text-center mb-8">
          Answer a few quick questions — no typing.
        </p>
        <QuestionnaireFlow
          role={role}
          reducedMotion={reducedMotion}
          onStepStatusChange={(stepIndex, totalSteps, status) =>
            setStepStatus({ stepIndex, totalSteps, status })
          }
        />
      </div>
      <JaxOnboardingGuide
        stepIndex={stepStatus.stepIndex}
        totalSteps={stepStatus.totalSteps}
        status={stepStatus.status}
        reducedMotion={reducedMotion}
      />
    </motion.div>
  );
}

export default function OnboardingShell({ role }: Props) {
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

  return <OnboardingShellWithMotion role={role} />;
}
