"use client";

import Image from "next/image";
import { motion } from "framer-motion";

type Status = "idle" | "submitting" | "error" | "success";

export const JAX_GUIDE_POSITION = "top-left" as const;
export type JaxGuidePosition = "top-left" | "top-right";

type Props = {
  stepIndex: number;
  totalSteps: number;
  status: Status;
  reducedMotion?: boolean;
  position?: JaxGuidePosition;
  showWatermark?: boolean;
  /** When true, render in-flow (relative) for alignment inside onboarding card header; otherwise fixed to viewport. */
  inline?: boolean;
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
 * Phase 2.1: Jax guidance integrated near onboarding header. Step-aware copy; respects reduced motion.
 * Position: top-left (default) or top-right within relative parent. Optional blended watermark behind card.
 */
export default function JaxOnboardingGuide({
  stepIndex,
  totalSteps,
  status,
  reducedMotion,
  position = JAX_GUIDE_POSITION,
  showWatermark = true,
  inline = false,
}: Props) {
  const message = getMessage(stepIndex, totalSteps, status);
  const isRight = position === "top-right";

  return (
    <>
      {/* Decorative watermark behind content — z-0, never blocks clicks */}
      {showWatermark && (
        <div
          className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none select-none"
          aria-hidden
        >
          <Image
            src="/assets/jax/jax-hero.webp"
            alt=""
            width={420}
            height={420}
            sizes="(max-width: 768px) 320px, 420px"
            quality={90}
            className="w-[320px] md:w-[420px] max-w-[85vw] opacity-[0.08] object-contain"
          />
        </div>
      )}

      {/* Guide: inline = in-flow for card header; otherwise fixed to viewport */}
      <motion.div
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, x: isRight ? 12 : -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reducedMotion ? 0.15 : 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={
          inline
            ? `flex max-w-[min(280px,calc(100vw-2rem))] ${isRight ? "flex-row-reverse" : ""}`
            : `fixed top-4 z-50 flex max-w-[min(280px,calc(100vw-2rem))] ${
                isRight ? "right-4 flex-row-reverse" : "left-4"
              }`
        }
        role="complementary"
        aria-live="polite"
        aria-label="Onboarding guidance"
      >
        <Image
          src="/assets/jax/jax-floating.webp"
          alt=""
          width={48}
          height={48}
          sizes="(max-width: 768px) 40px, 48px"
          quality={90}
          className="h-10 w-10 shrink-0 rounded-lg object-contain md:h-12 md:w-12"
        />
        <div
          className={`rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 px-3 py-2 shadow-md backdrop-blur-sm ${
            isRight ? "mr-2 md:mr-3" : "ml-2 md:ml-3"
          }`}
        >
          <p className="text-xs leading-snug text-[var(--muted)] line-clamp-2 md:text-sm md:line-clamp-none">
            {message}
          </p>
        </div>
      </motion.div>
    </>
  );
}
