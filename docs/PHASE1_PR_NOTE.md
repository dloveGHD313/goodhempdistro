# Phase 1: Persist welcome intents + post-auth routing

## What changed

- **Migration 082**: Adds `welcome_intents TEXT[]` and `welcome_intents_updated_at TIMESTAMPTZ` to `profiles`. (Existing columns `interests`, `purchase_intent`, `consumer_interest_tags` are used by consumer onboarding with different semantics.)
- **`lib/welcome-destination.ts`**: Maps intents to destination route (priority: sell → drivers → services → events → industrial → default /).
- **`POST /api/welcome/persist`**: Persists intents to profile when authenticated.
- **`components/PersistWelcomeProfile.tsx`**: Client component in root layout; on first authenticated load (except on /welcome), reads WelcomeProfile from localStorage, persists via API, clears storage, redirects to destination.
- **Routing rules** (priority order):
  1. sell → `/vendor-registration`
  2. drivers → `/logistics/apply`
  3. services → `/services`
  4. events → `/events`
  5. industrial → `/wholesale`
  6. default → `/`

## How to test

1. **Run migration**: Apply `supabase/migrations/082_phase1_welcome_intents.sql` to your Supabase project (Dashboard → SQL Editor).

2. **Signed-out → welcome → signup flow**:
   - Visit `/` signed out → redirected to `/welcome`
   - Select multiple intents (e.g. Sell + Events)
   - Click Continue → goes to `/signup`
   - Complete signup → lands on `/dashboard` (or first auth page)
   - Intents are persisted, localStorage cleared, redirect to `/vendor-registration` (sell has priority)

3. **Signed-in → welcome → Continue**:
   - Sign in, visit `/welcome`, select intents (e.g. Drivers)
   - Click Continue → goes to `/`
   - Persist runs, redirect to `/logistics/apply`

4. **Verify persistence**:
   - After persist, refresh or new session
   - Check `profiles.welcome_intents` and `welcome_intents_updated_at` in DB
   - localStorage `ghd_phase0_welcome_profile` should be cleared after persist

5. **No WelcomeProfile**:
   - Signed-in user with no localStorage profile → no persist, no redirect

6. **On /welcome**:
   - Persist does not run when pathname is `/welcome`; user must click Continue/Skip to leave.
