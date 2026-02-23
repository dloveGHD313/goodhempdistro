# Phase 0 — Deep Repo Audit: Onboarding, Routing, Roles, Newsfeed, Nav

## A) Current routing flow

- **`/`** → `redirect("/welcome")` (app/page.tsx).
- **`/welcome`** → Renders `WelcomeClient`. "Start here" CTA links to **`/get-started`**.
- **`/get-started`** → Currently shows:
  - Login / Sign Up links
  - **"Choose a Consumer Package"** (plans grid) — no questionnaire first.
- **`/onboarding`** → Auth required; redirects to signup if not logged in. Uses `welcome_intents` to compute single role → `OnboardingShell` + `QuestionnaireFlow` (card-based Q&A). On completion calls `/api/onboarding/submit` and redirects via `getDestinationForRole(role)`.
- **`/start`** → `StartFlowClient`: "Where do you fit?" path tiles (shopper, vendor, events, service_provider, logistics, builder, affiliate, education). Not the same as /get-started.

## B) Onboarding questionnaire

- **Components:** `QuestionnaireFlow`, `QuestionnaireCard`, `OnboardingShell`, `JaxOnboardingGuide`.
- **Lib:** `lib/onboarding/role.ts` (computeRoleFromWelcomeIntents), `lib/onboarding/questions.ts` (role-based question sets), `lib/onboarding/destination.ts` (getDestinationForRole).
- **API:** `/api/onboarding/submit` (persists onboarding_answers, onboarding_completed_at; single role), `/api/welcome/persist` (persists welcome_intents).
- **PersistWelcomeIntents:** When user is logged in and has WelcomeProfile intents in localStorage, persists to profile and redirects to `/onboarding`.
- **Phase2 workout flow:** `lib/phase2-workout-flow.ts` — workout_path (shopper, vendor, logistics, builder, affiliate, education), stored in localStorage; redirects after Start flow.
- **Gates:** Phase15Gate, OnboardingShell, onboardingGate (server), MascotGate.

## C) Roles (discovered)

- **DB `profiles.role`:** Single TEXT; values seen in migrations: `consumer`, `admin`. Default `consumer` (078).
- **DB `profiles.workout_path`:** TEXT, CHECK: shopper, vendor, logistics, builder, affiliate, education (091, 092).
- **OnboardingRole (app):** vendor, consumer, driver, affiliate, industrial (lib/onboarding/role.ts, questions.ts).
- **StartFlowClient path ids:** shopper, vendor, events, service_provider, logistics, builder, affiliate, education.
- **Mapping:** shopper→consumer, vendor→vendor, logistics→driver, builder→builder, affiliate→affiliate, education→educator, industrial from intents. Events/service_provider→vendor for redirect.

## D) Newsfeed signup flow

- **Route:** `app/newsfeed/page.tsx` → `FeedExperience`.
- **Logged-out:** Hero shows "Join" (href `/get-started`) and "Sign in" (href `/login`). Join is visible in flex-wrap gap-3.
- **Logged-in:** "Create post", "Go to feed", optional "Earn with JAX", roleCta (Vendor Dashboard / Driver Portal / Affiliate / Account).

## E) Educational / episodes area

- **Route:** `/learning-with-jax` — `LearningWithJaxMotion` (episodes/webisodes, "Learning with JAX").
- **Not in main Nav** primaryLinks or businessLinks; no top-level "Episodes" / "Webisodes" item.

## F) Nav overlap bug source

- **Nav.tsx:** Desktop right block: `hidden lg:flex items-center gap-4` — Logout (if logged in), secondaryCta link, primaryCta link. primaryCta is **single**: Vendor Dashboard OR Driver Portal OR Affiliate Portal OR Go to Feed OR Join Free. secondaryCta = "Go to Feed" when primary ≠ feed. So up to 3 items; overlap could occur if container is fixed width or flex doesn’t wrap. businessLinks includes "Affiliate Portal" and vendor link; primary CTA is one of vendor/driver/affiliate/feed/join. Overlap: when user is both vendor and affiliate, only one shows as primaryCta (priority: vendor > driver > affiliate > feed). So no literal duplicate CTAs; overlap is likely from **layout** (flex, min-width, or absolute positioning) on small desktop widths. Fix: ensure flex-wrap or single "Dashboard" dropdown when multiple roles.
