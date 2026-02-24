# Manual QA Checklist: Profile sync + Onboarding

Use this after deploying the auth/profile and onboarding fixes.

## 1) Returning user: custom display_name / username survives OAuth login

- **Setup**: Have a user who has already set a custom display name and/or username in Account (via PATCH /api/profile or account UI).
- **Steps**: Log out; log back in via OAuth (or magic link).
- **Verify**: GET /api/profile (or Account page) shows the **same** custom display_name and username as before login. They must not be overwritten by auth provider or callback.
- **DB check** (optional): `SELECT id, email, display_name, username FROM profiles WHERE id = '<user_id>';` — display_name and username should match the user’s prior customization.

## 2) Auth email change: profiles.email updates to match auth

- **Setup**: Change the user’s email in Supabase Auth (Dashboard or API) so auth.users.email is different from profiles.email.
- **Steps**: Trigger an auth callback (e.g. log in again so the callback runs, or run the flow that hits GET /auth/callback with code).
- **Verify**: `profiles.email` for that user equals the new auth email. GET /api/profile should return the new email.
- **DB check**: `SELECT p.id, p.email, au.email AS auth_email FROM profiles p JOIN auth.users au ON au.id = p.id WHERE p.id = '<user_id>';` — p.email should equal auth_email.

## 3) New signup: profile row has non-null email / display_name / username

- **Steps**: Create a new user (signup with email, or OAuth).
- **Verify**: After redirect/callback, the profiles row for that user has:
  - `email` = auth email (non-null when auth has email).
  - `display_name` = meta display_name or email prefix (non-null when email exists).
  - `username` = meta username or sanitized email prefix when possible (can be null only if no email and no meta).
- **Ways to check**: GET /api/profile after login, or DB: `SELECT id, email, display_name, username FROM profiles WHERE id = '<new_user_id>';`
- **Edge case**: Completing onboarding or age-verify when no profile existed yet must create a row with email, display_name, username (from auth), not NULLs.

## 4) /onboarding never white-screens; error boundary if something throws

- **Steps**: Open /onboarding while logged in (with a user who has not completed onboarding).
- **Verify**: Either the questionnaire flow renders (questions + Next/Back) or a clear fallback UI (“No questions right now” with “Go to Feed” / “Get started”), not a blank white screen.
- **If an error is thrown**: The onboarding error boundary (app/onboarding/error.tsx) should show “Something went wrong” and a “Try again” / “Get started” CTA, and the stack must be logged to console (check browser devtools).
- **Optional**: Force an empty question set (e.g. invalid role path) and confirm the fallback UI and single console.warn appear instead of a crash.

## 5) MCP (optional)

- If the MCP server is restarted and uses the updated `scripts/mcp/goodhemp-mcp.mjs`, run via MCP: `npm run verify:discovery`, `npm run verify:consumer-onboarding`, `npm run verify:phase3d`, `npm run build`. All should report success.
- If Cursor still reports “Script not allowed by MCP policy,” the block may be in Cursor’s MCP configuration rather than the repo; run the same scripts in a terminal and document that verification was done via terminal.

## CursorBot follow-up fixes (this PR)

- **Profile derivation**: All profile field derivation (email, display_name, username from auth user) is centralized in `lib/profile-utils.ts` (`deriveProfileFieldsFromUser`). Used by auth callback, onboarding submit, and age/verify so logic stays consistent and fixes apply in one place.
- **MCP npm errors**: Only ENOENT or "npm not found" messages are classified as "npm not found"; real script failures (e.g. build/test failure) now report "Script failed" with stdout/stderr instead of the misleading "npm not found" message.
