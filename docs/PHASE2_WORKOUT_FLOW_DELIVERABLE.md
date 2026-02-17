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

## Follow-ups (not in this PR)

- Optional: signup page honors `?next=` so post-signup redirects to workout destination (if not already implemented).
- Optional: migrate welcome/feed CTAs to `components/ui/Button` per check:ui-regressions (advisory).
