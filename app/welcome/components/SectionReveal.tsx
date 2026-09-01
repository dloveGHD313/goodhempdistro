"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type SectionRevealProps = {
  children: ReactNode;
  className?: string;
  delayMs?: number;
};

/**
 * Perf round 2 (Phase 7.5): visible-by-default reveal.
 *
 * The previous version server-rendered with `opacity-0`, hiding every
 * welcome-page section until hydration (LCP render delay). Now content is
 * fully visible in SSR/no-JS; after hydration, only sections that start
 * fully below the viewport are hidden and revealed on intersection.
 */
export default function SectionReveal({ children, className = "", delayMs = 0 }: SectionRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Never hide content already on (or partially on) screen — LCP-safe.
    if (node.getBoundingClientRect().top < window.innerHeight) return;

    // Hide via rAF (not synchronously in the effect) so the browser has
    // already painted the visible SSR content — and lint stays happy.
    const raf = requestAnimationFrame(() => setHidden(true));
    const fallbackTimer = setTimeout(() => setHidden(false), 2500);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setHidden(false);
            clearTimeout(fallbackTimer);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );

    observer.observe(node);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fallbackTimer);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${className} ${hidden ? "opacity-0 translate-y-6 pointer-events-none" : "opacity-100 translate-y-0"}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}
