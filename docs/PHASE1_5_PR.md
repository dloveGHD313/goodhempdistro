# Phase 1.5: Post-auth questionnaire + role-tailored onboarding

## What changed

- **Post-auth questionnaire**: Runs after signup/login, before dashboards/feed. Role-tailored from `profiles.welcome_intents`. Multiple-choice cards, no typing.
- **Migration 083**: Adds `onboarding_answers` (jsonb) and `onboarding_completed_at` (timestamptz) to `profiles`.
- **API**: `POST /api/onboarding/submit` persists answers; `GET /api/onboarding/status` returns completion status.
- **Gate**: Authenticated users without `onboarding_completed_at` are redirected to `/onboarding` before accessing `/`, `/dashboard`, `/account`, `/checkout`, `/vendors/*`. Admins bypass.
- **Routing**: After submit, users are routed by role: vendor → `/vendor-registration`, consumer → `/`, driver → `/logistics/apply` or `/vendor-registration` (vendor-listed), industrial → `/wholesale`, affiliate → `/affiliate`.

## How to test (Verification Checklist)

1. **Signed-out user cannot access /onboarding**  
   Visit `/onboarding` signed out → redirected to `/signup?redirect=/onboarding`.

2. **New user flow**  
   - Visit `/` signed out → redirected to `/welcome`  
   - Select intents (e.g. Shop, Sell) → Continue → `/signup`  
   - Complete signup → PersistWelcomeIntents runs → redirect to `/onboarding`  
   - Role-tailored questionnaire cards appear  
   - Must select an option to proceed; Back/Next work  
   - Submit persists answers, sets `onboarding_completed_at`, routes to destination

3. **Role routing**  
   - Sell intent → vendor questions → submit → `/vendor-registration`  
   - Drivers intent → driver questions (on-demand vs vendor-listed) → submit → `/logistics/apply` or `/vendor-registration`  
   - Shop/Explore intent → consumer questions → submit → `/` (feed)

4. **Returning user**  
   - User with `onboarding_completed_at` set does NOT get forced back to `/onboarding`.

5. **Build/tests**  
   - `npm run build` passes  
   - `npx vitest run __tests__/phase0-storage.test.ts` passes
