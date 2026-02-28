"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSafeReducedMotion } from "@/lib/useSafeReducedMotion";
import JaxEntryGreeting from "./JaxEntryGreeting";

type Props = {
  /** Content rendered below the hero fold (e.g. path-selection cards). */
  children?: ReactNode;
};

/**
 * Phase 0 cinematic full-viewport hero section.
 * Renders JAX greeting, headline, CTA buttons, and a scroll indicator.
 * Accepts children that appear below the hero fold — pass path-selection cards here.
 *
 * Uses only existing CSS tokens and framer-motion (already in package.json).
 * No new color values or external dependencies.
 */
export default function CinematicHero({ children }: Props) {
  const reducedMotion = useSafeReducedMotion();

  const fadeUp = (delay: number) => ({
    initial: reducedMotion ? undefined : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reducedMotion ? 0.1 : 0.6,
      delay: reducedMotion ? 0 : delay,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  });

  return (
    <div className="flex flex-col">
      {/* ── Full-viewport hero ── */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 py-16 futuristic-glow futuristic-grid-overlay"
        aria-label="Good Hemp Distro entry"
      >
        <div className="relative z-10 flex flex-col items-center max-w-3xl mx-auto w-full">
          {/* JAX greeting (hides itself when mascot flag is off) */}
          <JaxEntryGreeting />

          {/* Headline */}
          <motion.h1 className="hero-title text-accent mb-4" {...fadeUp(0.15)}>
            The hemp industry,
            <br />
            all in one place.
          </motion.h1>

          {/* Sub */}
          <motion.p className="hero-subtitle mb-10" {...fadeUp(0.25)}>
            Community. Commerce. Compliance. Fused.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="flex flex-col sm:flex-row gap-3 justify-center"
            {...fadeUp(0.35)}
          >
            <Link
              href="/signup"
              className="btn-primary motion-medium inline-block text-center min-w-[180px] py-3 px-8"
            >
              Create Account
            </Link>
            <Link
              href="/login"
              className="btn-secondary motion-medium inline-block text-center min-w-[180px] py-3 px-8"
            >
              Sign In
            </Link>
          </motion.div>
        </div>

        {/* Scroll chevron — only shown when children exist below */}
        {children && (
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-muted pointer-events-none"
            aria-hidden="true"
            initial={reducedMotion ? undefined : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: reducedMotion ? 0.1 : 0.6,
              delay: reducedMotion ? 0 : 0.65,
            }}
          >
            <span className="text-xs tracking-widest uppercase">Choose your path</span>
            <span className="text-lg animate-bounce">▼</span>
          </motion.div>
        )}
      </section>

      {/* ── Path cards / children below the fold ── */}
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
}
