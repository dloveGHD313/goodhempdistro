# Phase 1.1: Design Polish + Consistency Pass

## Visual QA grade report (from code review)

### `/` (homepage when logged in — FeedExperience variant="landing")

| Criterion | Grade notes |
|-----------|-------------|
| **Typography** | Scale exists (text-3xl/4xl, text-muted) but H1 doesn’t use shared `.hero-title`; eyebrow tracking is good. Line-height and weight are not token-driven. |
| **Spacing** | section-shell--tight 3rem, feed-hero p-6, gap-6; adequate but can feel cramped on small viewports. |
| **Contrast** | card-glass and lime border; text on dark is readable. Surfaces separate from background. |
| **Composition** | Two-column on lg (copy left, CTAs right). Hero is clear but CTAs sit alongside body without clear visual hierarchy. |
| **Motion** | No enter animations on hero content; motion is minimal. |
| **Premium feel** | **5/10** — Works but feels like a generic card hero. |

### `/welcome`

| Criterion | Grade notes |
|-----------|-------------|
| **Typography** | `.hero-title` and `.hero-subtitle` used; clear hierarchy. Mascot dialogue text-lg/xl. |
| **Spacing** | welcome-hero 2rem 1.5rem; mt-8 between mascot and content, mb-10 after subtitle. Could use slightly more rhythm. |
| **Contrast** | quiz-card glass, intent borders; good. |
| **Composition** | Single column, centered; mascot → logo → title → subtitle → quiz. Clear flow. |
| **Motion** | animate-fade-in, animate-scale-in with stagger; respects reduced motion. |
| **Premium feel** | **6/10** — Better than feed; softer glow and more spacing would help. |

### `/newsfeed` (feed route after onboarding)

| Criterion | Grade notes |
|-----------|-------------|
| Same as `/` with variant="feed"; title "Community News Feed". **Premium feel: 5/10.** |

### `/brand-check`

| Criterion | Grade notes |
|-----------|-------------|
| **Typography** | Ad-hoc (text-3xl, gray-300). No design-system scale. |
| **Spacing** | space-y-10, card p-6. |
| **Premium feel** | **4/10** — Utility page; not in scope for hero polish. |

---

## Top 5 visual problems addressed

1. **Typography hierarchy** — Feed hero H1 uses ad-hoc classes; aligned with `.hero-title` and consistent eyebrow for a single clear headline.
2. **Spacing rhythm** — Increased welcome-hero padding and vertical gaps; feed-hero max-width and padding for a calmer hero block.
3. **Glow / harsh edge** — Softer welcome-hero gradient (lower opacity); feed-hero border/glow toned down so it doesn’t look cheap.
4. **Nav + CTA consistency** — Nav dropdown item padding and hover clarified; feed CTAs kept as one primary + one secondary with consistent classes.
5. **Empty landmark (a11y)** — WelcomeClient loading state had only `aria-hidden` content inside main; added accessible loading text so the main landmark is not empty.

---

## Before/after summary

| Area | Before | After |
|------|--------|-------|
| Feed hero H1 | `text-3xl md:text-4xl font-bold text-accent` | Uses `.hero-title` for scale/weight/tracking consistency with welcome. |
| Feed hero container | `feed-hero card-glass p-6`, full width in shell | Same; added `max-w-4xl` on inner content and slightly increased padding for rhythm. |
| Welcome hero | padding 2rem 1.5rem; gradient 8% / 6% | padding 2.5rem 1.5rem; gradient 6% / 4% for subtler glow. |
| Welcome spacing | mt-8, mb-10 | mt-8, mb-8 on logo block; mb-10 on subtitle (unchanged); quiz-card margin unchanged. |
| Main (a11y) | WelcomeClient when !mounted: only aria-hidden divs | One sr-only “Loading…” so main has announced content. |
| Nav | (unchanged in this pass on main) | — |
| check:ui-regressions | — | New script: warns if key surfaces use raw `btn-primary`/`btn-secondary` instead of Button in app/welcome and app/newsfeed. |
| Design-system checklist | — | Documented in this file for future PRs. |

---

## Design-system usage checklist (for future PRs)

- [ ] **Key surfaces** (app/welcome, app/newsfeed FeedExperience hero): Prefer `components/ui/Button` over raw `btn-primary` / `btn-secondary` classes for primary/secondary CTAs.
- [ ] **Hero headlines**: Use `.hero-title` for the main H1 on welcome and feed hero for consistent scale and tracking.
- [ ] **Surfaces**: Use `.quiz-card`, `.card-glass`, or design-system Card for panels; avoid one-off rounded+shadow combos.
- [ ] **Motion**: Use `components/motion` (FadeIn, SlideUp) for hero enter; respect `prefers-reduced-motion` via existing utilities.
- [ ] **Landmarks**: Ensure `<main>` always has at least one visible or screen-reader-announced content (no main that’s only aria-hidden).

---

## Commands + results

- **npm run build** — PASS (exit 0).
- **npm run check:mascot-img** — PASS (no raw `<img>` mascot usage).
- **npm run check:ui-regressions** — Runs; warns if `app/welcome/WelcomeClient.tsx` or `app/newsfeed/FeedExperience.tsx` use raw `btn-primary` / `btn-secondary` (advisory, exit 0). Current state: warns (recommends migrating to `components/ui/Button` in a future PR).
