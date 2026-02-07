"use client";

import { motion } from "framer-motion";

type Props = {
  current: number;
  total: number;
  reducedMotion?: boolean;
};

export default function ProgressIndicator({ current, total, reducedMotion }: Props) {
  const progress = total > 0 ? (current / total) * 100 : 0;

  return (
    <div
      className="max-w-2xl mx-auto mb-6"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      aria-valuetext={`Question ${current + 1} of ${total}`}
    >
      <div className="flex items-center gap-2 text-sm text-muted mb-2">
        <span>Question {current + 1} of {total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--surface)]/60 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-[var(--brand-lime)]"
          initial={reducedMotion ? undefined : { width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: reducedMotion ? 0.1 : 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
