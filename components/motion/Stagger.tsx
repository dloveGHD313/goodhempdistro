"use client";

import React, { useEffect, useRef } from "react";
import { motion, type Variants } from "framer-motion";
import { useMotion } from "./MotionProvider";
import { MOTION_DISTANCES, STAGGER_DEFAULTS, VIEWPORT_DEFAULTS } from "./tokens";

const STAGGER_CHILD_MARKER = Symbol.for("StaggerChild");

const CHILD_VARIANTS_ANIMATED: Variants = {
  hidden: { opacity: 0, y: MOTION_DISTANCES.ySmall },
  visible: { opacity: 1, y: 0 },
};
const CHILD_VARIANTS_REDUCED: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
};

type StaggerProps = {
  children: React.ReactNode;
  className?: string;
  staggerChildren?: number;
  delayChildren?: number;
  as?: keyof typeof motion;
};

export function Stagger({
  children,
  className = "",
  staggerChildren = STAGGER_DEFAULTS.staggerChildren,
  delayChildren = STAGGER_DEFAULTS.delayChildren,
  as = "div",
}: StaggerProps) {
  const { reducedMotion } = useMotion();
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

  const container: Variants = reducedMotion
    ? { hidden: {}, visible: { transition: { staggerChildren: 0, delayChildren: 0 } } }
    : {
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren,
            delayChildren,
          },
        },
      };

  const Component = motion[as] as typeof motion.div;

  return (
    <Component
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: VIEWPORT_DEFAULTS.once, amount: VIEWPORT_DEFAULTS.amount }}
      className={className}
    >
      {children}
    </Component>
  );
}

/** Wraps a single child to participate in Stagger. Use with Stagger parent. */
function StaggerChildImpl({
  children,
  className = "",
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: keyof typeof motion;
}) {
  const { reducedMotion } = useMotion();
  const variants = reducedMotion ? CHILD_VARIANTS_REDUCED : CHILD_VARIANTS_ANIMATED;
  const Component = motion[as] as typeof motion.div;
  return <Component variants={variants} className={className}>{children}</Component>;
}

export const StaggerChild = Object.assign(StaggerChildImpl, {
  [STAGGER_CHILD_MARKER]: true as const,
});

export default Stagger;
