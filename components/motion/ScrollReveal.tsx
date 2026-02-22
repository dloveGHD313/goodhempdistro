"use client";

import { motion, type Variants } from "framer-motion";
import { useMotion } from "./MotionProvider";
import { MOTION_DISTANCES, VIEWPORT_DEFAULTS } from "./tokens";

type ScrollRevealProps = {
  children: React.ReactNode;
  className?: string;
  once?: boolean;
  amount?: number;
  duration?: number;
  y?: number;
  as?: keyof typeof motion;
};

export function ScrollReveal({
  children,
  className = "",
  once = VIEWPORT_DEFAULTS.once,
  amount = VIEWPORT_DEFAULTS.amount,
  duration,
  y = MOTION_DISTANCES.ySmall,
  as = "div",
}: ScrollRevealProps) {
  const { reducedMotion, transition } = useMotion();
  const t = duration !== undefined ? { ...transition, duration } : transition;

  const variants: Variants = reducedMotion
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : {
        hidden: { opacity: 0, y },
        visible: {
          opacity: 1,
          y: 0,
          transition: t,
        },
      };

  const Component = motion[as] as typeof motion.div;

  return (
    <Component
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={variants}
      transition={reducedMotion ? { duration: 0 } : t}
      className={className}
    >
      {children}
    </Component>
  );
}

export default ScrollReveal;
