# Motion audit — discovery

## Routes (app/)

- **/** — Root: redirects logged-in users; shows StartFlowClient when not logged in.
- **/welcome** — Welcome/onboarding entry (hero + JAX + CTAs).
- **/home** — Marketing home (hero, feature grid, community links, services, CTA). Uses HomeMotion client.
- **/learning-with-jax** — Education portal (hero, pillars, featured episode, tracks, membership, newsletter). Uses LearningWithJaxMotion client.
- **/pricing** — Pricing page (consumer/vendor tabs, plan cards). Client component.
- **/newsfeed** — Feed landing; renders FeedExperience (variant="feed").
- **/events**, **/education**, **/start**, **/discover**, **/products**, **/services**, **/login**, **/signup**, **/onboarding**, **/brand-check**, etc. — Other routes.

Primary landing/conversion routes: **/**, **/welcome**, **/home**, **/learning-with-jax**, **/pricing**, **/newsfeed**.

## Global layout

- **app/layout.tsx** — Root: html/body, MarketModeProvider, app-bg div, header (Nav), **MotionProvider > PageTransition > {children}**, PersistWelcomeIntents, Phase15Gate, MascotGate, AgeGateClient, RecoveryHashRedirect.
- No route-group layouts under app/ that wrap multiple pages.
- MotionProvider + PageTransition already wrap only the main content (children), not html/body.

## Existing motion usage

- **Framer Motion:** Used in components/motion (Reveal, ScrollReveal, Stagger, StaggerChild, PageTransition), WelcomeClient, HomeMotion, LearningWithJaxMotion, onboarding (JaxOnboardingGuide, QuestionnaireFlow, QuestionnaireCard, ProgressIndicator, OnboardingShell).
- **CSS (globals.css):** welcome-gradient-shift, phase0-fade-in, phase0-scale-in, jax-hero-float, mascot keyframes (floatIn, typingPulse, idleBounce, mascotBlink, focusedLean, successNod, errorShake, blockedStop, attentionPop, pulseGlow). All respect `prefers-reduced-motion` where applicable.
- **Motion context:** MotionProvider provides reducedMotion (useSafeReducedMotion) and transition (duration 0.55, ease [0.22,1,0.36,1]); reduced motion sets duration 0.

## Shared UI components

- **components/ui/HeroShell.tsx** — Hero wrapper (cinematic, glassPanel, mascotSlot, ctaRow).
- **components/ui/FeatureSection.tsx** — Section with eyebrow, title, description.
- **components/ui/Drawer.tsx** — Drawer UI.
- **Nav.tsx**, **Footer.tsx** — Global nav and footer.
- No shared Button component; pages use **btn-primary**, **btn-secondary**, **btn-ghost** (globals.css).
- Cards: **card-glass**, **card-glass--raised**, **surface-glass** (globals.css). No single Card component.

## Design system classes (preserved)

- section-shell, section-shell--tight, card-glass, welcome-hero, futuristic-glow, hero-title, hero-subtitle, btn-primary, btn-secondary, surface-glass, text-accent, text-muted.

## Top 5 high-impact pages to upgrade

1. **/welcome** — WelcomeClient: hero title/subtitle/CTAs, JAX visual; already uses Reveal + hover. Standardize delays (title 0, subtitle 0.08, CTA 0.16, secondary 0.24) and tokens.
2. **/home** — HomeMotion: hero, feature grid, community links, services, CTA. Already uses Reveal/ScrollReveal/Stagger/hover. Ensure tokens + consistent delays.
3. **/learning-with-jax** — LearningWithJaxMotion: sections + grids + CTAs. Already uses ScrollReveal/Stagger/hover. Ensure tokens + consistent delays.
4. **/pricing** — Pricing page: plan cards and CTAs. Add ScrollReveal for sections, Stagger for plan cards, HoverLift for cards/buttons.
5. **/newsfeed** — FeedExperience: animate hero + top filters + first row only; do not animate infinite list.
