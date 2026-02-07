"use client";

import { motion } from "framer-motion";

type Status = "idle" | "submitting" | "error" | "success";

type Props = {
  stepIndex: number;
  totalSteps: number;
  status: Status;
  reducedMotion?: boolean;
};

const STEP_MESSAGES: Record<number, string> = {
  0: "What interests you most? Pick one to personalize your feed.",
  1: "Nice. Now tell us how you want to engage.",
  2: "Almost done — choose what you're looking for.",
};

function getMessage(stepIndex: number, totalSteps: number, status: Status): string {
  if (status === "submitting") return "Saving your answers…";
  if (status === "error") return "Something went wrong — try again.";
  if (status === "success") return "All set! Taking you to your feed…";
  if (stepIndex in STEP_MESSAGES) return STEP_MESSAGES[stepIndex as keyof typeof STEP_MESSAGES];
  if (stepIndex >= totalSteps - 1) return "Almost done — choose what you're looking for.";
  return "Pick an option to continue.";
}

/**
 * Phase 2.1: Jax guidance panel on onboarding. Step-aware copy; respects reduced motion.
 */
export default function JaxOnboardingGuide({
  stepIndex,
  totalSteps,
  status,
  reducedMotion,
}: Props) {
  const message = getMessage(stepIndex, totalSteps, status);

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reducedMotion ? 0.15 : 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="fixed bottom-24 right-6 z-10 max-w-[280px] rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 p-4 shadow-lg backdrop-blur-sm sm:bottom-6"
      role="complementary"
      aria-live="polite"
      aria-label="Jax guidance"
    >
      <div className="flex gap-3">
        <img
          src="/mascot/jax/idle.png"
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-lg object-contain"
        />
        <p className="text-sm text-[var(--muted)] leading-snug">{message}</p>
      </div>
    </motion.div>
  );
}
