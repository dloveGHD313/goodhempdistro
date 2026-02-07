# Phase 1: Persist welcome intents + onboarding shell

## What changed

- **PersistWelcomeIntents** (`components/PersistWelcomeIntents.tsx`): Client component in root layout. On first authenticated load (when not on `/welcome`), reads WelcomeProfile from localStorage, persists to `profiles.welcome_intents` via `/api/welcome/persist`, clears localStorage, redirects to `/onboarding`. Uses `pathname?.startsWith("/welcome")` guard and `didRunRef` to avoid loops.
- **Onboarding shell** (`app/onboarding/page.tsx`, `OnboardingShellClient.tsx`): Replaced immediate redirect with a placeholder questionnaire shell. Title: "Let's tailor your experience", subtext: "Answer a few quick questions — no typing.", Continue button → `/onboarding/consumer` or `/onboarding/vendor` based on vendor status. Protected: unauthed → redirect to `/signup`.
- **Removed**: `PersistWelcomeProfile`, `lib/welcome-destination.ts` (PR #72 approach).
- **Flow**: `/welcome` → select intents → Continue → `/signup` → signup/login → first authed load → persister runs → redirect to `/onboarding` → shell → Continue → consumer/vendor questionnaire.

## How to test

1. **Signed out → welcome → signup flow**
   - Visit `/` signed out → redirected to `/welcome`
   - Select multiple intents (e.g. Shop + Events)
   - Click Continue → goes to `/signup`
   - Complete signup → lands on first authed page
   - Persister runs, intents persisted, localStorage cleared, redirect to `/onboarding`
   - See shell: "Let's tailor your experience" with Continue button
   - Click Continue → goes to `/onboarding/consumer` (or vendor if applicable)

2. **Verify persistence**
   - After persist, check `profiles.welcome_intents` and `welcome_intents_updated_at` in Supabase
   - localStorage `ghd_phase0_welcome_profile` should be cleared

3. **No WelcomeProfile**
   - Signed-in user with no localStorage profile → no persist, no redirect; normal page behavior

4. **On /welcome**
   - Persister does not run when pathname starts with `/welcome`

5. **Onboarding protected**
   - Visit `/onboarding` signed out → redirected to `/signup?redirect=/onboarding`
