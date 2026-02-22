"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSafeReducedMotion } from "@/lib/useSafeReducedMotion";
import { MOTION_EASE, MOTION_DURATIONS } from "./tokens";

export type MotionTransition = {
  duration: number;
  ease: [number, number, number, number];
};

const defaultTransition: MotionTransition = {
  duration: MOTION_DURATIONS.base,
  ease: [...MOTION_EASE],
};

type MotionContextValue = {
  reducedMotion: boolean;
  transition: MotionTransition;
};

const MotionContext = createContext<MotionContextValue>({
  reducedMotion: false,
  transition: defaultTransition,
});

export function useMotion() {
  return useContext(MotionContext);
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const reducedMotion = useSafeReducedMotion();
  const transition: MotionTransition = reducedMotion
    ? { duration: 0, ease: [0, 0, 0, 0] }
    : defaultTransition;

  return (
    <MotionContext.Provider value={{ reducedMotion, transition }}>
      {children}
    </MotionContext.Provider>
  );
}

export default MotionProvider;
