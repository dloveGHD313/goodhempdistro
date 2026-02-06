# Phase 0: Entry Experience + Design System + JAX Scaffold — PR Note

## What changed

- **Design tokens & motion:** `app/globals.css` — Added CSS variables for motion presets (`--motion-heavy-duration`, `--motion-medium-*`, `--motion-minimal-*`), utility classes (`.motion-heavy`, `.motion-medium`, `.motion-minimal`), and UI primitives for welcome (`.welcome-hero`, `.quiz-card`, `.animate-fade-in`, `.animate-scale-in`).
- **Public `/welcome` page:** New `app/welcome/page.tsx` and `app/welcome/WelcomeClient.tsx` — Cinematic entry with logo, hero copy, and “What brings you here?” quiz (Shop / Sell / Events / Explore). Intent stored in `localStorage` via `lib/phase0-storage.ts` (keys `ghd_phase0_welcome_intent`, `ghd_phase0_welcome_answers`). No DB writes; future wiring can attach to profile after sign-in.
- **JAX floating scaffold:** `components/mascot/JaxFloatingScaffold.tsx` — Wraps existing mascot widget with a Phase 0 data attribute; used in root layout instead of `MascotMountClient`. `/welcome` added to mascot context so JAX appears on the welcome page.
- **Nav:** “Welcome” link added to primary nav.
- **Tests:** `__tests__/phase0-storage.test.ts` — Round-trip and key prefix tests for welcome storage.

## What did not change

- No Stripe, payment routes, checkout, or vendor billing logic.
- No DB migrations, no RLS changes.
- No COA or product-creation flows.
- No changes to existing onboarding redirect logic (still account-gated).
- Middleware unchanged; `/welcome` remains public (not in protected list).

## How to test

1. **Build & lint:** `npm run build` and `npm run lint` (baseline lint issues unchanged).
2. **Welcome (public):** Open `/welcome` signed out. See hero, quiz, choose an intent; see “Continue” / “Sign in” / “Create account”. Reload and confirm intent persists from `localStorage`.
3. **JAX on welcome:** With `NEXT_PUBLIC_MASCOT_ENABLED=true`, open `/welcome` and confirm JAX floating widget is visible.
4. **Smoke:** Sign in/out, vendor dashboard loads, product create still works, checkout and comments/moderation unchanged.

## Rollback

- Revert branch or the four commits. No migrations to undo.
- To revert only layout mascot change: replace `JaxFloatingScaffold` with `MascotMountClient` in `app/layout.tsx` and remove `components/mascot/JaxFloatingScaffold.tsx` and the `/welcome` branch in `components/mascot/context.ts`.
