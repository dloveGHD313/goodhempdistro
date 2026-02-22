"use client";

import { motion, type Variants } from "framer-motion";
import { useMotion } from "./MotionProvider";
import { MOTION_DISTANCES } from "./tokens";

type Direction = "up" | "down" | "left" | "right";

const directionOffset = (d: Direction) => ({
  up: { y: MOTION_DISTANCES.ySmall },
  down: { y: -MOTION_DISTANCES.ySmall },
  left: { x: MOTION_DISTANCES.ySmall },
  right: { x: -MOTION_DISTANCES.ySmall },
}[d]);

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: Direction;
  duration?: number;
  as?: keyof typeof motion;
};

export function Reveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
  duration,
  as = "div",
}: RevealProps) {
  const { reducedMotion, transition } = useMotion();
  const t = duration !== undefined ? { ...transition, duration } : transition;
  const offset = directionOffset(direction);

  const variants: Variants = reducedMotion
    ? { initial: { opacity: 1, y: 0, x: 0 }, animate: { opacity: 1, y: 0, x: 0 } }
    : {
        initial: { opacity: 0, ...offset, ...(direction === "up" || direction === "down" ? { x: 0 } : { y: 0 }) },
        animate: { opacity: 1, y: 0, x: 0 },
      };

  const Component = motion[as] as typeof motion.div;

  return (
    <Component
      initial="initial"
      animate="animate"
      variants={variants}
      transition={reducedMotion ? { duration: 0 } : { delay, ...t }}
      className={className}
    >
      {children}
    </Component>
  );
}

export default Reveal;
