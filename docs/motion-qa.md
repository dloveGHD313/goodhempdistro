# Motion QA checklist

## Routes tested

- **/welcome** — Hero (JAX, logo, title, subtitle, CTAs) reveal with HERO_DELAYS; HoverLift on "Start here"; "Sign in" link in secondary block.
- **/home** — Hero (eyebrow, title, subtitle, CTAs) Reveal with HERO_DELAYS; ScrollReveal + Stagger + StaggerChild on feature grid, community links, services; HoverLift on primary CTAs and "View All Services" / "Get Started".
- **/learning-with-jax** — ScrollReveal on hero and sections; Stagger + StaggerChild on pillars and tracks; HoverLift on "Watch Episode 001" and "Explore Topics".
- **/pricing** — ScrollReveal on section; Stagger + StaggerChild on consumer/vendor plan cards; HoverLift on tab buttons and Subscribe/Start checkout buttons.
- **/newsfeed** — Reveal on feed hero; ScrollReveal on filter bar; HoverLift on Create post, Go to feed, Join, Sign in. Post list is **not** animated (no infinite list animation).

## Reduced motion

- MotionProvider uses `useSafeReducedMotion()`; when `prefers-reduced-motion: reduce`, transition duration is 0 and Reveal/ScrollReveal/Stagger/PageTransition use no-op variants (opacity 1, y 0).
- HoverLift disables whileHover/whileTap when `reducedMotion` is true.
- CSS keyframes (e.g. jax-hero-float) are disabled under `@media (prefers-reduced-motion: reduce)` in globals.css.

## No layout shift

- All motion uses opacity and transform (translateY/translateX, scale) only. No height/width animation.

## No hydration warnings

- MotionProvider and all motion components are client components ("use client"). useSafeReducedMotion runs in useEffect to avoid SSR mismatch. No layout shift from motion.

## No heavy animations on long lists

- Feed/newsfeed: only hero and filter bar are animated; post list is static.
- Home/learning-with-jax/pricing: Stagger is used for bounded grids (features, community links, services, pillars, tracks, plan cards), not for unbounded feeds.

## Newsletter signup (Learning with JAX)

- Form at `/learning-with-jax` (#newsletter) POSTs to `/api/newsletter/subscribe`; email is persisted to `newsletter_signups` (Supabase). Success UI only after `ok: true`; errors shown inline. Duplicate email is idempotent (returns success).
