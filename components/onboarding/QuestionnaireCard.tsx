"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import type { Question, QuestionOption } from "@/lib/onboarding/questions";

type Props = {
  question: Question;
  selected: string | null;
  onSelect: (value: string) => void;
  stepIndex: number;
  totalSteps: number;
  disabled?: boolean;
  error?: string | null;
  reducedMotion?: boolean;
  direction?: number; // 1 = next, -1 = back
};

const SLIDE_DISTANCE = 24;

export default function QuestionnaireCard({
  question,
  selected,
  onSelect,
  stepIndex,
  totalSteps,
  disabled,
  error,
  reducedMotion,
  direction = 1,
}: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const xEnter = direction >= 0 ? SLIDE_DISTANCE : -SLIDE_DISTANCE;
  const xExit = direction >= 0 ? -SLIDE_DISTANCE : SLIDE_DISTANCE;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [stepIndex]);

  return (
    <motion.div
      key={question.id}
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: xEnter, filter: "blur(4px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: xExit, filter: "blur(4px)" }}
      transition={{ duration: reducedMotion ? 0.1 : 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="max-w-2xl mx-auto surface-card p-8 space-y-6"
    >
      <div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-xl md:text-2xl font-bold text-accent mb-4 outline-none"
        >
          {question.prompt}
        </h2>

        {error && (
          <motion.div
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            className="mb-4 p-4 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-sm"
            role="alert"
          >
            {error}
          </motion.div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {question.options.map((opt: QuestionOption) => (
            <motion.button
              key={opt.value}
              type="button"
              onClick={() => !disabled && onSelect(opt.value)}
              disabled={disabled}
              whileHover={!disabled && !reducedMotion ? { scale: 1.02 } : undefined}
              whileTap={!disabled ? { scale: 0.98 } : undefined}
              className={`relative rounded-xl border-2 px-4 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-lime)] focus:ring-offset-2 focus:ring-offset-[var(--bg)] ${
                disabled ? "cursor-not-allowed opacity-80" : "cursor-pointer"
              } ${
                selected === opt.value
                  ? "border-[var(--brand-lime)] bg-[var(--brand-lime)]/15"
                  : "border-[var(--border)] bg-[var(--surface)]/60 hover:border-[var(--brand-lime)]/70 hover:bg-[var(--surface)]"
              }`}
            >
              {selected === opt.value && !reducedMotion && (
                <motion.span
                  layoutId={`glow-${question.id}-${opt.value}`}
                  className="absolute inset-0 rounded-xl border-2 border-[var(--brand-lime)] pointer-events-none"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  style={{
                    boxShadow: "0 0 12px rgba(102, 209, 30, 0.25)",
                  }}
                />
              )}
              <span className="relative font-medium text-white">{opt.label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
