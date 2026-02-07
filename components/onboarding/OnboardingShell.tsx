"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { OnboardingRole } from "@/lib/onboarding/role";
import QuestionnaireFlow from "./QuestionnaireFlow";

type Props = {
  role: OnboardingRole;
};

/**
 * Phase 2: Wrapper with page entrance animation.
 */
export default function OnboardingShell({ role }: Props) {
  const reducedMotion = useReducedMotion() ?? false;
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
        <QuestionnaireFlow role={role} reducedMotion={reducedMotion} />
      </div>
    </motion.div>
  );
}
