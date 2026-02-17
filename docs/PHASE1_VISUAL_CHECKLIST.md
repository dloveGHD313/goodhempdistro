# Phase 1: Futuristic UI — Visual verification checklist

## Commands run + results

- **npm run build** — PASS (exit 0)
- **npm run check:mascot-img** — PASS (no raw `<img>` mascot usage)

---

## What to check visually

### `/` (homepage when logged in)

- [ ] Hero uses **HeroShell**: cinematic glow + grid overlay behind content.
- [ ] Glass panel wraps headline, description, and “Live updates enabled”.
- [ ] **Typography**: Eyebrow “Good Hemp Social”, H1 uses `.hero-title` (premium scale).
- [ ] **CTAs**: “Create post” / “Join” and “Go to feed” / “Sign in” use design system; primary has hover glow (`cta-glow-hover`).
- [ ] **Motion**: FadeIn/SlideUp on hero copy (respects reduced motion).
- [ ] No layout shift; feed grid and composer below hero unchanged.

### `/welcome`

- [ ] **Background**: Existing `.welcome-hero` gradient + radial glow; no regression.
- [ ] **Mascot**: JAX has soft halo (`.hero-mascot-halo`) so it blends; no harsh edge; shadow still crisp.
- [ ] **Quiz card**: Glass panel, intent buttons with hover/press (scale, glow, focus-visible).
- [ ] **CTAs**: Continue = `Button` primary; Skip = link with secondary styling.
- [ ] No layout shift; no console errors.

### `/brand-check`

- [ ] Page still renders: typography scale, Buttons, Badges, Input, Surfaces, Logo, Mascot grid.
- [ ] No broken layout or missing tokens.

### Nav (all pages)

- [ ] **Dropdowns**: Use `bg-surface-1`, `border-border`; hover uses `bg-surface-2`.
- [ ] **Links**: Existing `.nav-link` hover (accent); focus-visible where applicable.
- [ ] **Primary CTA**: “Join” / “Vendor Dashboard” etc. consistent with design system.

### Performance

- [ ] No obvious jank on route change or hero enter.
- [ ] LCP not harmed (hero has no huge new images; Next/Image unchanged for mascot).

---

## Files changed (Phase 1)

| Area | Files |
|------|--------|
| Background utilities | `app/globals.css` (futuristic-glow, grid, noise, surface-glass, cta-glow-hover, hero-mascot-halo) |
| New components | `components/ui/HeroShell.tsx`, `components/ui/FeatureSection.tsx` |
| Homepage (feed) | `app/newsfeed/FeedExperience.tsx` (HeroShell, Button, FadeIn, SlideUp, heroCtaRow) |
| Welcome mascot | `components/mascot/JaxWelcomeHero.tsx` (hero-mascot-halo) |
| Nav | `components/Nav.tsx` (surface-1, surface-2, border, motion-minimal on dropdowns) |
| Doc | `docs/PHASE1_VISUAL_CHECKLIST.md` |

---

## Suggested commit message(s)

Single commit:

```
feat(ui): Phase 1 futuristic UI rollout — hero shell, feed welcome nav
```

Or split:

1. `chore(ui): add Phase 1 background utilities + HeroShell + FeatureSection`
2. `ui: apply futuristic shell to feed hero and nav dropdowns`
3. `ui: mascot halo on welcome for blend; Phase 1 checklist doc`
