"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useMotion } from "./MotionProvider";
import { MOTION_DISTANCES } from "./tokens";

type HeroParallaxProps = {
  children: React.ReactNode;
  className?: string;
  /** Multiplier for parallax strength (1 = default small range). */
  strength?: number;
  as?: keyof typeof motion;
};

/**
 * Small, optional hero parallax wrapper.
 * Uses scroll position to nudge content up slightly and add a tiny scale.
 * Disabled automatically when reducedMotion is true.
 */
export function HeroParallax({
  children,
  className = "",
  strength = 1,
  as = "div",
}: HeroParallaxProps) {
  const { reducedMotion } = useMotion();
  const ref = useRef<HTMLDivElement | null>(null);

  const clampedStrength = Number.isFinite(strength) && strength > 0 ? Math.min(strength, 1.5) : 1;

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 85%", "end 15%"],
  });

  const maxY = -MOTION_DISTANCES.ySmall * clampedStrength;
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    reducedMotion ? [0, 0] : [0, maxY]
  );
  const scale = useTransform(
    scrollYProgress,
    [0, 1],
    reducedMotion ? [1, 1] : [1, 1 + 0.01 * clampedStrength]
  );

  const Component = motion[as] as typeof motion.div;

  return (
    <Component ref={ref} style={{ y, scale }} className={className}>
      {children}
    </Component>
  );
}

export default HeroParallax;

