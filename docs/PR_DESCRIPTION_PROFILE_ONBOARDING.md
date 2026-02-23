# PR: Auth profile sync + onboarding white-screen + MCP

## Summary

- **Profile sync**: Email is auth-authoritative and stays in sync; user-customized `display_name` and `username` are never overwritten on login. New signups and app-created profile rows get non-null email/display_name/username where possible.
- **Onboarding**: `/onboarding` no longer shows a white screen when the question set is empty; a fallback UI and diagnostic log are shown instead. Error boundary remains and logs stack on throw.
- **MCP**: npm runner uses a shell so `npm` is found on PATH; allowlist includes verify scripts; clearer error when npm is missing. (If Cursor still blocks scripts via “Script not allowed,” run verification in terminal.)

## Root causes

1. **Trigger 101** (auth.users sync): `ON CONFLICT DO UPDATE` always set `display_name` and `username` from auth, overwriting user-customized values on every auth update.
2. **Onboarding submit + age/verify**: When creating a profile row (no existing profile), insert omitted `email`, `display_name`, `username`, leading to NULL profile rows.
3. **QuestionnaireFlow**: When `questions.length === 0`, the component returned `null`, rendering a blank area (white screen).
4. **MCP npm_run**: `execFile("npm.cmd", ...)` failed with ENOENT when the MCP process had no PATH to npm.

## Fix details

- **Migration 102** (`102_profiles_sync_preserve_user_fields.sql`): Replaces `handle_auth_user_profile_sync` so that on `ON CONFLICT DO UPDATE`, email is always taken from auth when non-empty; `display_name` and `username` are updated only when the existing value is NULL or empty. Adds username fallback from sanitized email prefix in the trigger. Triggers themselves unchanged (101 already created them).
- **Auth callback** (`app/auth/callback/route.ts`): Already correct (email when changed; display_name/username only when missing). No change.
- **Onboarding submit** (`app/api/onboarding/submit/route.ts`): When inserting a new profile, sets `email`, `display_name`, `username` from the current auth user (meta or email prefix / sanitized prefix).
- **Age verify** (`app/api/age/verify/route.ts`): When inserting a new profile, sets `email`, `display_name`, `username`, `market_mode_preference`, `updated_at` so no NULL-only rows are created.
- **QuestionnaireFlow** (`components/onboarding/QuestionnaireFlow.tsx`): When there is no `currentQuestion` (e.g. empty question set), renders a fallback card (“No questions right now”) with “Go to Feed” and “Get started” links and a one-time `console.warn` with role and answer keys instead of returning `null`.
- **MCP** (`scripts/mcp/goodhemp-mcp.mjs`): Uses `exec(..., { shell: true })` for `npm run <script>` so PATH is used; adds `verify:env` to allowlist; improves error message when npm is not found; 5-minute timeout.

## Files changed

| Path | Reason |
|------|--------|
| `docs/PHASE0_DISCOVERY_SUMMARY.md` | Discovery summary (profile sync, onboarding, MCP). |
| `supabase/migrations/102_profiles_sync_preserve_user_fields.sql` | Trigger: preserve user display_name/username; email from auth; username fallback. |
| `app/api/onboarding/submit/route.ts` | Insert profile with email, display_name, username from auth. |
| `app/api/age/verify/route.ts` | Insert profile with email, display_name, username, market_mode_preference. |
| `components/onboarding/QuestionnaireFlow.tsx` | Fallback UI + diagnostic log when question set is empty. |
| `scripts/mcp/goodhemp-mcp.mjs` | npm run via shell; allowlist + timeout; better errors. |
| `docs/QA_CHECKLIST_PROFILE_ONBOARDING.md` | Manual QA steps. |
| `docs/PR_DESCRIPTION_PROFILE_ONBOARDING.md` | This PR description. |

## MCP verification results (terminal)

Run in repo root (MCP may still block; then use terminal):

- **npm run verify:discovery** — PASS  
- **npm run verify:consumer-onboarding** — PASS  
- **npm run verify:phase3d** — PASS (build + vitest)  
- **npm run build** — PASS  

## Manual QA steps

See `docs/QA_CHECKLIST_PROFILE_ONBOARDING.md`:

1. Returning user: custom display_name/username survives OAuth login.  
2. Auth email change: profiles.email updates to match auth.  
3. New signup: profile has non-null email/display_name/username.  
4. /onboarding does not white-screen; error boundary shows and logs stack on error.  
5. (Optional) MCP: run verify/build via MCP after server restart, or via terminal.
