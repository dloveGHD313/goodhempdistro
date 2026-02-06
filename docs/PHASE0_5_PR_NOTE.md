# Phase 0.5: Cinematic Welcome + JAX Greeter + Multi-Select Onboarding

## Summary

This PR completes the entry experience (Phase 0.5) so signed-out users see a cinematic onboarding profiler before accessing the home feed. JAX is the primary greeter; users can select multiple intents; selections persist in localStorage and will later drive feed personalization.

## Changes

### 1. Signed-Out Gating to /welcome

- **Route:** `app/page.tsx` (home `/`)
- **Behavior:** Server-side auth check using `createSupabaseServerClient().auth.getUser()`. If user is **not** authenticated → `redirect("/welcome")`. If authenticated → render existing home/feed unchanged.
- **No redirect loop:** `/welcome` is public and ungated. Signed-in users are never forced back to `/welcome`; they go straight to `/` and see the feed.

### 2. Multi-Select Onboarding Profile

- **Storage:** `lib/phase0-storage.ts`
  - New type: `WelcomeProfile` with `version: 1`, `intents: string[]`, `createdAt`.
  - Key: `ghd_phase0_welcome_profile`.
  - Helpers: `getWelcomeProfile()`, `setWelcomeProfile(patch)` (merge), `clearWelcomeProfile()`, `getWelcomeIntents()`.
  - Hydration-safe: all storage reads check `typeof window === "undefined"`.

- **Intent options (9, multi-select):**
  1. Shop (Buy products)
  2. Sell (Vendor / Brand)
  3. Events
  4. Explore (Community / Feed)
  5. Services (Hire / Offer services)
  6. Drivers (Logistics)
  7. Affiliates
  8. Business (Wholesale / B2B)
  9. Industrial / Hemp Building

- **Continue / Skip:**
  - **Continue:** Enabled only when ≥1 intent selected. Signed-out → `/signup`. Signed-in → `/`.
  - **Skip for now:** Shown only when signed-in; navigates to `/`. Signed-out users cannot bypass (no skip link).

### 3. JAX as Hero Greeter

- **Component:** `components/mascot/JaxWelcomeHero.tsx`
  - Center/hero placement above the intent grid.
  - Visible only when mascot flag is enabled (`NEXT_PUBLIC_MASCOT_ENABLED=true` and `MASCOT_AI_ENABLED=true`).
  - Animated entrance (fade + scale) using existing motion tokens.
  - Dialogue reacts to state:
    - No selections: “Hey, I'm JAX. Pick everything you're here for…”
    - 1+ selections: “Nice. I'll tailor your experience around that.”
  - Respects `prefers-reduced-motion` (animations disabled in `globals.css` media query).

- **Floating JAX:** Unchanged. `JaxFloatingScaffold` remains in the layout; on `/welcome`, hero JAX is primary, floating JAX secondary.

### 4. Prep for Personalization

- **Export:** `getWelcomeIntents(): string[]` from `lib/phase0-storage.ts`.
- **TODO comments** added in feed/home areas: “Later phases will personalize ranking based on welcome intents.” No algorithm change in this PR.

## Deferred to Phase 1+

- Feed algorithm personalization based on intents.
- DB persistence of welcome profile (attach to profile after sign-in).
- DID video / richer onboarding media.

## QA Checklist

- [ ] Signed-out visiting `/` → redirected to `/welcome`
- [ ] `/welcome` shows JAX hero (when mascot enabled) + heavy animation
- [ ] Multi-select works; selection persists on refresh
- [ ] Continue: signed-out → `/signup`, signed-in → `/`
- [ ] Skip for now: visible only when signed-in; navigates to `/`
- [ ] Signed-in users never forced to `/welcome`
- [ ] No hydration warnings
- [ ] Vercel preview succeeds
