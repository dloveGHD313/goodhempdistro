"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";
import { MOTION_DISTANCES, VIEWPORT_DEFAULTS } from "./tokens";

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  once?: boolean;
  amount?: number;
  duration?: number;
  y?: number;
  as?: keyof React.JSX.IntrinsicElements;
};

/**
 * Perf round 2 (Phase 7.5): visible-by-default scroll reveal.
 *
 * The previous framer-motion `whileInView` implementation server-rendered
 * content with inline `opacity:0`, hiding whole sections until hydration —
 * a major LCP render delay on slow mobile. Now:
 *
 *   1. SSR / no-JS: content is fully visible. Nothing depends on JS to paint.
 *   2. After hydration, only elements that start FULLY BELOW the viewport are
 *      hidden (`.ghd-sr-pending`) and revealed by an IntersectionObserver
 *      (`.ghd-sr-in`). Above-the-fold content is never touched.
 *
 * Reduced-motion users skip the effect entirely.
 */
export function ScrollReveal({
  children,
  className = "",
  once = VIEWPORT_DEFAULTS.once,
  amount = VIEWPORT_DEFAULTS.amount,
  duration,
  y = MOTION_DISTANCES.ySmall,
  as = "div",
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Only animate elements that start fully below the viewport; anything
    // already on screen stays visible (LCP-safe).
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.classList.add("ghd-sr-pending");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("ghd-sr-in");
            if (once) io.unobserve(entry.target);
          } else if (!once) {
            el.classList.remove("ghd-sr-in");
          }
        }
      },
      { threshold: amount }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [amount, once]);

  const style: CSSProperties = {};
  if (y !== MOTION_DISTANCES.ySmall) {
    (style as Record<string, string>)["--ghd-sr-y"] = `${y}px`;
  }
  if (duration !== undefined) {
    (style as Record<string, string>)["--ghd-sr-duration"] = `${duration}s`;
  }

  const Tag = as as ElementType;
  return (
    <Tag ref={ref} className={`ghd-sr ${className}`} style={Object.keys(style).length > 0 ? style : undefined}>
      {children}
    </Tag>
  );
}

export default ScrollReveal;
