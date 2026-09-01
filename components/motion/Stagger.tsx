"use client";

import React, { createElement, useEffect, useRef } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";
import { STAGGER_DEFAULTS } from "./tokens";

const STAGGER_CHILD_MARKER = Symbol.for("StaggerChild");

type StaggerProps = {
  children: ReactNode;
  className?: string;
  staggerChildren?: number;
  delayChildren?: number;
  as?: keyof React.JSX.IntrinsicElements;
};

/**
 * Perf round 2 (Phase 7.5): visible-by-default staggered reveal.
 *
 * The previous framer-motion `whileInView` container server-rendered every
 * StaggerChild with inline `opacity:0` (this hid the /pricing plan cards —
 * the LCP element — until hydration). Now:
 *
 *   1. SSR / no-JS: children are fully visible.
 *   2. After hydration, containers that start fully below the viewport get
 *      `.ghd-stagger-pending` (children hidden via CSS) and an
 *      IntersectionObserver adds `.ghd-stagger-in` to run the staggered
 *      transition. Per-child delays come from nth-child rules in globals.css
 *      driven by the CSS vars below.
 *
 * Reduced-motion users skip the effect entirely.
 */
export function Stagger({
  children,
  className = "",
  staggerChildren = STAGGER_DEFAULTS.staggerChildren,
  delayChildren = STAGGER_DEFAULTS.delayChildren,
  as = "div",
}: StaggerProps) {
  const ref = useRef<HTMLElement | null>(null);
  const hasWarned = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || hasWarned.current) return;
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && (child.type as unknown as { [key: symbol]: unknown })?.[STAGGER_CHILD_MARKER] !== true) {
        hasWarned.current = true;
        console.warn(
          "[motion] Stagger expects direct children to be StaggerChild. Wrap each item in <StaggerChild> for staggered reveal."
        );
      }
    });
  }, [children]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;

    el.classList.add("ghd-stagger-pending");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("ghd-stagger-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const style: CSSProperties = {};
  if (staggerChildren !== STAGGER_DEFAULTS.staggerChildren) {
    (style as Record<string, string>)["--ghd-stagger-step"] = `${staggerChildren}s`;
  }
  if (delayChildren !== STAGGER_DEFAULTS.delayChildren) {
    (style as Record<string, string>)["--ghd-stagger-base"] = `${delayChildren}s`;
  }

  const Tag = as as ElementType;
  return (
    <Tag ref={ref} className={`ghd-stagger ${className}`} style={Object.keys(style).length > 0 ? style : undefined}>
      {children}
    </Tag>
  );
}

/** Wraps a single child to participate in Stagger. Use with Stagger parent. */
function StaggerChildImpl({
  children,
  className = "",
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
}) {
  return createElement(as, { className: `ghd-stagger-child ${className}` }, children);
}

export const StaggerChild = Object.assign(StaggerChildImpl, {
  [STAGGER_CHILD_MARKER]: true as const,
});

export default Stagger;
