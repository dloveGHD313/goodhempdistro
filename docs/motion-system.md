# Motion System

## Discovery summary (pre-implementation)

- **CSS animations (globals.css):** `welcome-gradient-shift`, `phase0-fade-in`, `phase0-scale-in`, `jax-hero-float`, mascot keyframes (`floatIn`, `typingPulse`, `idleBounce`, `mascotBlink`, `focusedLean`, `successNod`, `errorShake`, `blockedStop`, `attentionPop`, `pulseGlow`). All respect `@media (prefers-reduced-motion: reduce)` where applicable.
- **Framer Motion:** Already a dependency (^12.33.0). Used in onboarding: `JaxOnboardingGuide`, `QuestionnaireFlow`, `QuestionnaireCard`, `ProgressIndicator`, `OnboardingShell`. No existing `components/motion/` primitives.
- **Reduced motion:** `lib/useSafeReducedMotion.ts` provides a safe hook (no matchMedia during SSR); use instead of framer-motion’s `useReducedMotion` to avoid client issues.
- **Key pages for motion:** `/welcome` (WelcomeClient hero + JAX), `/learning-with-jax` (sections + grids), `/home` (hero + feature cards), newsfeed (FeedExperience).

## Primitives

All under `components/motion/`. Use `"use client"`; accept `className` and `children`; default to subtle premium motion (opacity 0→1, y 12→0, duration 0.5–0.7, ease out); disable or minimize when `prefers-reduced-motion: reduce`.

| Component        | Purpose |
|-----------------|--------|
| **MotionProvider** | Context: `reducedMotion`, default transition. Wrap app (or motion subtree) so primitives can read it. |
| **Reveal**      | On-mount fade + slide; optional `delay`, `direction` (up/down/left/right), `duration`. |
| **ScrollReveal**| Animates when in view (`whileInView`); `once={true}` by default; viewport `amount` ~0.2–0.3. |
| **Stagger**     | Wraps list/grid; staggers children on reveal (optional `delayChildren` / `staggerChildren`). |
| **PageTransition** | Route transition: `AnimatePresence` + `motion.div` keyed by pathname. Used in root layout via client wrapper. |

## Defaults

- **Transition:** duration 0.5–0.7s, ease `[0.22, 1, 0.36, 1]` (ease out).
- **Reveal:** `initial={{ opacity: 0, y: 12 }}`, `animate={{ opacity: 1, y: 0 }}`.
- **ScrollReveal:** `once: true`, `amount: 0.2` (or 0.3).
- **Reduced motion:** Set `transition: { duration: 0 }` and/or `initial={false}` so animations become instant or skipped.

## Micro-interactions

- Cards / primary CTAs: `whileHover={{ scale: 1.02, y: -2 }}`, `transition: { duration: 0.15–0.2 }`. Use sparingly.

## Usage

```tsx
import { Reveal } from "@/components/motion/Reveal";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { Stagger } from "@/components/motion/Stagger";

<Reveal delay={0.1}>
  <h1>Title</h1>
</Reveal>

<ScrollReveal once amount={0.2}>
  <section>...</section>
</ScrollReveal>

<Stagger staggerChildren={0.08} delayChildren={0.1} className="grid grid-cols-2 gap-4">
  {items.map((item) => (
    <StaggerChild key={item.id}>
      <div>...</div>
    </StaggerChild>
  ))}
</Stagger>
```

**Hover (cards/CTAs):** Use `motion.span` or `motion.div` with `whileHover={{ scale: 1.02, y: -2 }}` and `transition={{ duration: 0.18 }}`. Guard with `useMotion().reducedMotion` so hover is disabled when user prefers reduced motion.

## Testing

- **Build:** `npm run build`
- **Reduced motion:** Toggle “Reduce motion” in OS (e.g. Windows: Settings → Accessibility → Visual effects). Animations should be instant or minimal.
- **No layout shift:** Animations use transform/opacity only; no reserved space changes.
