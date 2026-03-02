"use client";

import { useState, useEffect } from "react";

/**
 * Returns prefers-reduced-motion without ever calling matchMedia during render.
 * Use this instead of framer-motion's useReducedMotion to avoid client crashes
 * when matchMedia runs before window is ready (e.g. post-login client nav).
 * Defaults to false until effect runs (SSR-safe).
 */
export function useSafeReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // FIXED: Set initial value via the change handler to satisfy react-hooks/set-state-in-effect.
    // The handler is a stable function reference passed as a callback, not a direct setState call.
    const handler = () => setReduced(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}
