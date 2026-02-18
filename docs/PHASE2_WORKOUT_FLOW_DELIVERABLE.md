# Phase 2: Workout Flow — What Changed / Why / How to Verify

## What changed

- **New route:** `/start` — guided path selection (Shopper, Vendor, Logistics, Builder) then one follow-up step (sign up first or continue without account), then redirect.
- **New lib:** `lib/phase2-workout-flow.ts` — `getWorkoutFlowState()`, `setWorkoutFlowState()`, `clearWorkoutFlowState()`, `WORKOUT_REDIRECTS`. State: `selectedPath`, `timestamp`, `lastStepCompleted`; stored in localStorage.
- **Entry points updated:** Nav "Join Free" → `/start`; homepage "Get Started Now" and "Get Started" → `/start`; feed hero "Join" → `/start`; welcome page: added "Start here" link (to choose path first).

## Why

- Single conversion path: choose your path → minimal question → redirect. Stops guessing; routes users to the right experience (discover, vendor-registration, logistics/apply, services).
- Aligns with CEO vision: premium, futuristic, conversion-first onboarding.

## How to verify

### Commands (already run)

- `npm run build` — PASS
- `npm run check:mascot-img` — PASS
- `npm run check:ui-regressions` — PASS (advisory warnings only)

### Manual visual checklist

| Area | Check |
|------|--------|
| **/welcome** | Hero, mascot halo (if enabled), quiz; "Start here" link visible when not logged in (next to "Sign in"). |
| **/start** | Step 1: 4 path tiles (Shopper, Vendor, Logistics, Builder); glass panel, futuristic glow/grid. Step 2: "Sign me up, then take me there" / "Continue without account"; "Choose a different path" back. |
| **Nav** | "Join Free" goes to `/start`. |
| **Homepage (/home)** | "Get Started Now" and bottom "Get Started" go to `/start`. |
| **Feed hero (logged out)** | "Join" goes to `/start`. |
| **Redirects** | Shopper → `/discover`; Vendor → `/vendor-registration`; Logistics → `/logistics/apply`; Builder → `/services`. |
| **Mobile + desktop** | Path grid 1 col mobile, 2 col sm+; buttons stack on small screens. No layout shift. |

### Routes for QA

- `/start` — full flow
- `/welcome` — then click "Start here"
- `/home` — then click "Get Started Now"
- Nav (logged out) — click "Join Free"
- `/newsfeed` (logged out) — hero "Join"

## Files changed (single commit)

- `lib/phase2-workout-flow.ts` (new)
- `app/start/page.tsx` (new)
- `app/start/StartFlowClient.tsx` (new)
- `components/Nav.tsx` (Join Free href → /start)
- `app/home/page.tsx` (Get Started links → /start)
- `app/newsfeed/FeedExperience.tsx` (Join → /start)
- `app/welcome/WelcomeClient.tsx` (Start here link)
- `docs/PHASE2_WORKOUT_FLOW_DELIVERABLE.md` (this file)

## Auth Redirect Gate + Events/Education

### What changed

- **Post-auth redirect:** All login/signup redirects now go through `POST /api/auth/post-login-route`. Onboarding gating wins: if the user needs onboarding (`getPostLoginRoute(profile) === "/onboarding"`), they are always sent to `/onboarding`; only then are `next` or `workoutPath` considered. The `next` parameter can no longer bypass onboarding.
- **Callback:** Same logic: after email verification, redirect is computed with onboarding first, then safe `next`, then workout default, then post-login fallback. No open redirects.
- **Start flow paths:** Added **Events** (maps to vendor: redirect `/vendor-registration`, persist `workout_path=vendor`) and **Education** (redirect `/education`, persist `workout_path=education`). Schema: migration `092_profiles_workout_path_education.sql` adds `education` to `profiles.workout_path` CHECK.
- **Education page:** New `/education` with hero “Education Hub”, placeholders for Learning with JAX, Compliance & Rules, and category grid (Farming, Retail, Logistics, Construction, Compliance). Uses existing `HeroShell`, `FeatureSection`, `surface-glass`, `futuristic-glow`.

### Discovery summary (for BugBot)

- **Onboarding gating:** Implemented in `lib/routing/postLoginRoute.ts`: `getPostLoginRoute(profile)` returns `"/onboarding"` when profile is null or when `onboarding_completed_at` or `consumer_onboarding_completed` is falsy (admin always gets `/dashboard`). This is the single condition that forces first-time users to onboarding.
- **Previous bypass:** LoginForm and SignupForm, when `next` or `role` was present, redirected client-side (using next if safe, else default route for role) without calling the post-login API, so onboarding was skipped.
- **Fix:** Clients always call `POST /api/auth/post-login-route` with `{ next, workoutPath, role }`; the API returns `redirectTo` after applying onboarding-first logic. Callback uses the same order: mandatory post-login route, then safe next, then workout default.

## Phase 3A: Public browsing + conversion gates

### What changed

- **Public browsing:** Events (`/events`), Shop (`/products`), and Services (`/services`) are accessible without an account. Feed (`/newsfeed`) is viewable without login; interactions (like, comment, post, flag) require auth and redirect to signup/login with a safe `next` when unauthenticated.
- **Start flow — Service Provider:** "Continue without account" for Service Provider now routes to the **public `/services`** page (was `/discover`). "Sign me up, then take me there" still goes to vendor onboarding; `workout_path` is persisted as `vendor` (service_provider is a UI alias only).
- **Start flow — Events:** "Continue without account" routes to `/events` (public). Signup intent remains vendor (role/vendor).
- **Public `/services` page:** New landing at `/services` (no auth gate): hero "Services" / "Find help in the hemp industry", category placeholder cards (Logistics, Compliance, Marketing, Construction, Processing), and primary CTA "Become a Service Provider" → `/signup?next=/vendor-registration&role=vendor` (next validated via `isSafeNextPath`). Services layout no longer uses `requireConsumerOnboarding`.
- **Consistency:** Start flow UI shows both destinations: "After you sign up: …" and "Continue without account: …" so displayed text matches actual behavior for both actions.

### Verification

- `getPublicRedirectForStartPath("service_provider")` → `/services`; `"events"` → `/events`; others → `/discover` or `/education` as before.
- Unit tests in `__tests__/phase2-workout-flow.test.ts` cover public redirects; no gated route is ever returned for any Start path.

## Phase 3B: Public shop rules + conversion gates + compliance-safe product rules

### What changed

- **Public Events:** `/events` remains public (no auth redirect). Start flow "Continue without account" for Events → `/events`; "Sign me up…" → vendor onboarding (unchanged).
- **Public Shop (logged-out limited):** `/products` remains public (no redirect to login). Logged-out users see only products in categories that do **not** require COA (e.g. apparel/merch). Products in COA-required categories are **hidden** from the list when not signed in. Data-driven: uses existing `getCategoryCoaRequirement` / `getCategoriesCoaRequirementMap` and category slug/name rules (no new laws; configurable via categories).
- **Product detail (COA-required + logged out):** If a logged-out user opens a direct link to a product whose category requires COA, they see a **locked** view: title, category, vendor, short description, and a CTA **"Sign in to view / buy"** linking to `/login?next=/products/[id]` (safe next only). No price, COA, or purchase; checkout is not allowed.
- **Feed:** Unchanged from Phase 3A: public read; like/comment/post/flag require auth and redirect with safe `next`.
- **Vendor product compliance:** Unchanged: create/update use draft mode (COA does not block); submit enforces COA when `category_requires_coa`; `hemp_derived_attestation` required.
- **Start flow:** Destination text still shows both "After you sign up: …" and "Continue without account: …" (no misleading copy).

### New/updated code

- `lib/compliance.ts`: `getCategoriesCoaRequirementMap(supabase, categoryIds)` for batch COA-by-category (used by products list).
- `app/products/page.tsx`: When `!user`, `getProducts(…, publicShopOnly: true)` filters out products whose category requires COA.
- `app/products/[id]/page.tsx`: When `!user && product.category_requires_coa`, render locked view with login CTA and safe `next`.

### Verification

- Logged out: `/products` shows only non–COA-required categories; `/products/[id]` for a COA-required product shows locked view and "Sign in to view / buy".
- Logged in: full product list and full detail with buy.
- No new schema/migrations for Phase 3B.

## Follow-ups (not in this PR)

- Optional: migrate welcome/feed CTAs to `components/ui/Button` per check:ui-regressions (advisory).
