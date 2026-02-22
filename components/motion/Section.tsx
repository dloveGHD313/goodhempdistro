"use client";

import type { HTMLAttributes } from "react";
import { ScrollReveal } from "./ScrollReveal";

type SectionProps = HTMLAttributes<HTMLElement> & {
  id?: string;
};

/**
 * Convenience wrapper for a section that should scroll-reveal into view.
 * Keeps semantics with a real <section> while delegating motion to ScrollReveal.
 */
export function Section({ id, className = "", children, ...rest }: SectionProps) {
  return (
    <ScrollReveal>
      <section id={id} className={className} {...rest}>
        {children}
      </section>
    </ScrollReveal>
  );
}

export default Section;

