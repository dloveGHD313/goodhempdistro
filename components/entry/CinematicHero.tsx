"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSafeReducedMotion } from "@/lib/useSafeReducedMotion";
import { entryHeroCopy } from "@/lib/entryCopy";
import JaxEntryGreeting from "./JaxEntryGreeting";

type Props = {
  /** Content rendered below the hero fold (e.g. path-selection cards). */
  children?: ReactNode;
};

/**
 * Phase 0 cinematic full-viewport hero section.
 *
 * LCP fix: H1 and subtitle are now rendered as plain elements (not motion.h1 / motion.p)
 * so they are visible in the initial HTML paint. Previously, initial: { opacity: 0 }
 * was serialized into the SSR HTML, hiding them until framer-motion hydrated (~1-3s).
 *
 * CTAs still animate in (they are not the LCP element). Scroll chevron still animates.
 */
export default function CinematicHero({ children }: Props) {
  const reducedMotion = useSafeReducedMotion();

  const ctaFade = {
    initial: reducedMotion ? undefined : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: reducedMotion ? 0.1 : 0.5,
      delay: reducedMotion ? 0 : 0.3,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  };

  return (
    <div className="flex flex-col">
      {/* ── Full-viewport hero ── */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 py-16 futuristic-glow futuristic-grid-overlay"
        aria-label="Good Hemp Distro entry"
      >
        <div className="relative z-10 flex flex-col items-center max-w-3xl mx-auto w-full">
          {/* JAX greeting */}
          <JaxEntryGreeting />

          {/* Headline — plain h1 so it is visible in initial HTML (LCP element) */}
          <h1 className="hero-title text-accent mb-4">
            {entryHeroCopy.headlineLines.map((line, idx) => (
              <Fragment key={line}>
                {line}
                {idx < entryHeroCopy.headlineLines.length - 1 && <br />}
              </Fragment>
            ))}
          </h1>

          {/* Subtitle — plain p so it is visible in initial HTML */}
          <p className="hero-subtitle mb-10">
            {entryHeroCopy.subtitle}
          </p>

          {/* CTAs — animate in (not LCP candidate, safe to delay) */}
          <motion.div
            className="flex flex-col sm:flex-row gap-3 justify-center"
            {...ctaFade}
          >
            <Link
              href={entryHeroCopy.primaryCTA.href}
              className="btn-primary motion-medium inline-block text-center min-w-[180px] py-3 px-8"
            >
              {entryHeroCopy.primaryCTA.label}
            </Link>
            <Link
              href={entryHeroCopy.secondaryCTA.href}
              className="btn-secondary motion-medium inline-block text-center min-w-[180px] py-3 px-8"
            >
              {entryHeroCopy.secondaryCTA.label}
            </Link>
          </motion.div>
        </div>

        {/* Scroll chevron — animate in */}
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
            <span className="text-xs tracking-widest uppercase">{entryHeroCopy.scrollHint}</span>
            <span className="text-lg animate-bounce">▼</span>
          </motion.div>
        )}
      </section>

      {/* ── Path cards / children below the fold ── */}
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
}
