"use client";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMotion } from "./MotionProvider";

type PageTransitionProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageTransition({ children, className = "" }: PageTransitionProps) {
  const pathname = usePathname();
  const { reducedMotion, transition } = useMotion();

  const variants = reducedMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 },
      };

  const t = reducedMotion ? { duration: 0 } : { duration: transition.duration, ease: transition.ease };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        transition={t}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export default PageTransition;
