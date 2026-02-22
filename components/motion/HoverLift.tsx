"use client";

import { motion } from "framer-motion";
import { useMotion } from "./MotionProvider";
import { HOVER_MOTION, TAP_MOTION } from "./tokens";

type HoverLiftProps = {
  children: React.ReactNode;
  as?: keyof typeof motion;
  className?: string;
  disabled?: boolean;
};

/**
 * Central wrapper for consistent hover/tap micro-interactions.
 * No hover/tap motion when reducedMotion is true.
 */
export function HoverLift({
  children,
  as = "div",
  className = "",
  disabled = false,
}: HoverLiftProps) {
  const { reducedMotion } = useMotion();
  const Component = motion[as] as typeof motion.div;

  return (
    <Component
      className={className}
      whileHover={
        reducedMotion || disabled
          ? undefined
          : { y: HOVER_MOTION.y, scale: HOVER_MOTION.scale, transition: { duration: HOVER_MOTION.duration } }
      }
      whileTap={
        reducedMotion || disabled
          ? undefined
          : { scale: TAP_MOTION.scale, transition: { duration: TAP_MOTION.duration } }
      }
    >
      {children}
    </Component>
  );
}

export default HoverLift;
