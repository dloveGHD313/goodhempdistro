import type { CSSProperties, ElementType, ReactNode } from "react";

type Direction = "up" | "down" | "left" | "right";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: Direction;
  duration?: number;
  as?: ElementType;
};

/**
 * Perf round 2 (Phase 7.5): CSS-only entrance animation.
 *
 * The previous framer-motion implementation server-rendered content with an
 * inline `opacity:0` (the serialized "initial" variant), so hero headings —
 * the LCP element on every public route — stayed invisible until the full JS
 * bundle downloaded and hydrated. On mobile that was seconds of pure render
 * delay. CSS animations start at first paint with zero JS, and this is now a
 * server component (no hydration cost at all).
 *
 * Reduced-motion is handled in globals.css via `prefers-reduced-motion`.
 * Keyframes/classes: `.ghd-reveal`, `.ghd-reveal-{up,down,left,right}`.
 */
export function Reveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
  duration,
  as: Tag = "div",
}: RevealProps) {
  const style: CSSProperties | undefined =
    delay || duration !== undefined
      ? {
          ...(delay ? { animationDelay: `${delay}s` } : {}),
          ...(duration !== undefined ? { animationDuration: `${duration}s` } : {}),
        }
      : undefined;

  return (
    <Tag className={`ghd-reveal ghd-reveal-${direction} ${className}`} style={style}>
      {children}
    </Tag>
  );
}

export default Reveal;
