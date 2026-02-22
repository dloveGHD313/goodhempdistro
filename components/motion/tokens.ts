/**
 * Single source of truth for motion: timing, easing, distances, viewport, hover/tap.
 * Use these in MotionProvider, Reveal, ScrollReveal, Stagger, PageTransition, HoverLift.
 */

export const MOTION_EASE = [0.22, 1, 0.36, 1] as const;

export const MOTION_DURATIONS = {
  fast: 0.18,
  base: 0.55,
  slow: 0.75,
} as const;

export const MOTION_DISTANCES = {
  ySmall: 12,
  yMedium: 18,
} as const;

export const VIEWPORT_DEFAULTS = {
  once: true,
  amount: 0.25,
} as const;

export const HOVER_MOTION = {
  y: -2,
  scale: 1.02,
  duration: 0.18,
} as const;

export const TAP_MOTION = {
  scale: 0.98,
  duration: 0.12,
} as const;

export const STAGGER_DEFAULTS = {
  staggerChildren: 0.08,
  delayChildren: 0.1,
} as const;

/** Hero entrance delays (seconds) */
export const HERO_DELAYS = {
  title: 0,
  subtitle: 0.08,
  ctaRow: 0.16,
  secondary: 0.24,
} as const;
