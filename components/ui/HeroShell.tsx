"use client";

import type { ReactNode } from "react";

type HeroShellProps = {
  children: ReactNode;
  /** Optional slot above main content (e.g. mascot) */
  mascotSlot?: ReactNode;
  /** Optional CTA row below main content */
  ctaRow?: ReactNode;
  /** Use cinematic background (glow + optional grid) */
  cinematic?: boolean;
  /** Wrap main content in glass panel */
  glassPanel?: boolean;
  className?: string;
  contentClassName?: string;
};

export function HeroShell({
  children,
  mascotSlot,
  ctaRow,
  cinematic = true,
  glassPanel = true,
  className = "",
  contentClassName = "",
}: HeroShellProps) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center text-center ${cinematic ? "futuristic-glow futuristic-grid-overlay" : ""} ${className}`}
    >
      {mascotSlot && (
        <div className="relative z-10 w-full flex-shrink-0 flex justify-center">
          {mascotSlot}
        </div>
      )}
      <div className={`relative z-10 w-full flex flex-col items-center ${contentClassName}`}>
        {glassPanel ? (
          <div className="surface-glass rounded-[var(--radius-xl)] p-6 sm:p-8 w-full max-w-2xl">
            {children}
          </div>
        ) : (
          children
        )}
        {ctaRow && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {ctaRow}
          </div>
        )}
      </div>
    </div>
  );
}

export default HeroShell;
