"use client";

import type { ReactNode } from "react";

type FeatureSectionProps = {
  /** Small label above title */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Optional icon grid or card list */
  children?: ReactNode;
  /** Optional gradient behind section */
  gradient?: boolean;
  className?: string;
  contentClassName?: string;
};

export function FeatureSection({
  eyebrow,
  title,
  description,
  children,
  gradient = false,
  className = "",
  contentClassName = "",
}: FeatureSectionProps) {
  return (
    <section
      className={`relative py-12 sm:py-16 ${gradient ? "futuristic-glow" : ""} ${className}`}
    >
      <div className={`relative z-10 max-w-4xl mx-auto px-6 ${contentClassName}`}>
        {eyebrow && (
          <p className="text-xs uppercase tracking-[0.35em] text-muted mb-3">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-4">
          {title}
        </h2>
        {description && (
          <p className="text-muted max-w-2xl mb-8">
            {description}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}

export default FeatureSection;
