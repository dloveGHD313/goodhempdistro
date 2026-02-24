# PHASE 0 DISCOVERY SUMMARY

## A) White screen after signup/sign-in

- **Route**: `/onboarding` (server component `app/onboarding/page.tsx`) → renders `<OnboardingShell role={role} />` (client).
- **Client chain**: `OnboardingShell` → `OnboardingShellWithMotion` → `QuestionnaireFlow(role)` with no `flatQuestions`/`initialAnswers`. Questions come from `getQuestionsForRole(role)`; `role` from `computeRoleFromWelcomeIntents(profile?.welcome_intents ?? [])` (always returns a valid `OnboardingRole`, default `"consumer"`).
- **Root cause hypothesis**: 
  1. **Empty questions**: In `QuestionnaireFlow.tsx` line 269, `if (!currentQuestion) return null;` — when `questions.length === 0`, the component renders **null**, producing a blank area. `getQuestionsForRole` always returns a non-empty set (default `CONSUMER_QUESTIONS`), so empty only if an invalid role slips through at runtime.
  2. **Hydration/SSR**: `OnboardingShell` defers render until `mounted`; `useSafeReducedMotion` does not call `matchMedia` during render — low risk.
- **Evidence**: `components/onboarding/QuestionnaireFlow.tsx` L84–85, L269: `currentQuestion = questions[step]`; when `questions.length === 0`, `currentQuestion` is `undefined` → return null → white area. No throw; error boundary would only catch thrown errors.
- **Conclusion**: Fix by (1) never returning null for empty questions — render a deterministic fallback UI with CTA and diagnostic log; (2) keep error boundary; (3) add invariant log when question set is empty.

---

## B) Auth profile sync architecture (sources of truth)

| Source | Creates/updates | Fields written | Notes |
|-------|------------------|----------------|------|
| **app/auth/callback/route.ts** | Yes | Existing: email (when changed), display_name/username (only when missing). New: id, email, role, display_name, username, market_mode_preference, updated_at. | Preserves user-customized display_name/username (lines 88–101). Email synced when `existingEmailNorm !== incomingEmailNorm`. |
| **supabase/migrations/009_auto_create_profiles.sql** | Trigger on auth.users INSERT | id, email, role, display_name (meta or NULL), created_at, updated_at. ON CONFLICT DO NOTHING. | Replaced by 101: 101 drops and recreates `on_auth_user_created`. |
| **supabase/migrations/101_profiles_sync_from_auth_users.sql** | Trigger on auth.users INSERT + UPDATE (email, raw_user_meta_data) | INSERT/ON CONFLICT DO UPDATE: email, display_name, username, role, market_mode_preference, updated_at. | **Bug**: ON CONFLICT DO UPDATE uses `COALESCE(EXCLUDED.display_name, profiles.display_name)` — so when auth sends a display_name (e.g. OAuth), it **overwrites** existing profile display_name/username every time the trigger runs (e.g. on auth.users update). |
| **app/api/profile/route.ts** PATCH | Update | display_name, avatar_url, banner_url, border_style (user-initiated). | Does not touch email. |
| **app/api/onboarding/submit/route.ts** | Update or Insert | Update: onboarding_answers, onboarding_completed_at, roles, updated_at. Insert (when no profile): id, role, roles, onboarding_answers, onboarding_completed_at, updated_at, market_mode_preference — **no email, display_name, username**. | **Root cause of NULL profile rows**: insert path creates rows with NULL email/display_name/username. |
| **app/api/age/verify/route.ts** | Insert or Update | Insert: id, age_verified, role. Update: age_verified. | Insert creates row without email/display_name/username. |

**Current “source of truth” rules (code intent)**  
- **Email**: Auth-authoritative; callback already updates when changed (L94–95). Trigger 101 also overwrites email on conflict (correct).  
- **display_name/username**: Callback correctly only fills when missing. Trigger 101 **incorrectly** overwrites them on every sync.

---

## C) CursorBot issue (auth callback existing-profile updates)

- **File**: `app/auth/callback/route.ts` lines 88–101.
- **Code**: For existing profile, `updatePatch.email = incomingEmail` only when `incomingEmail && existingEmailNorm !== incomingEmailNorm`. So **email changes from auth do update** profiles.email when the existing email differs.  
- **Verdict**: **CONFIRMED FIXED** in current code. Email is synced when changed; display_name/username only filled when missing.

---

## D) NULL profiles on new signups

- **Causes**:  
  1. **onboarding submit** (L120–128): When `!existingProfile?.id`, inserts profile with id, role, roles, onboarding_answers, onboarding_completed_at, updated_at, market_mode_preference — **no email, display_name, username**.  
  2. **age/verify**: Same pattern — insert without email/display_name/username.  
  3. **Trigger 101**: Runs on auth.users INSERT/UPDATE. For **new** signups, trigger runs first and should create row with email/display_name/username. So NULLs occur when (a) profile is created by **app insert** (onboarding or age/verify) before or instead of trigger, or (b) trigger ran but with empty auth meta (e.g. email not yet set).  
- **Trigger vs callback**: Migration 101 replaces 009’s trigger. After 101, only `handle_auth_user_profile_sync` runs on insert/update. Trigger’s ON CONFLICT DO UPDATE **overwrites** display_name/username with auth meta every time — conflicts with “never overwrite user-customized” and can overwrite after OAuth refresh.  
- **Chosen architecture**: **Option 1 — DB trigger canonical.**  
  - Trigger: (1) Always set email from auth (auth-authoritative). (2) For display_name/username, only set when current profile value is NULL or empty (preserve user-customized). (3) On INSERT, set display_name/username from meta or safe fallback (email prefix; username = meta or sanitized email prefix).  
  - Callback: Ensure profile exists; sync email when changed; never overwrite non-empty display_name/username (already does this).  
  - App inserts (onboarding submit, age/verify): Prefer **no raw insert** — ensure profile exists (trigger or callback created it); if missing, upsert with email/display_name/username from current auth user.

---

## E) MCP toolchain status

- **.cursor/mcp.json**: Server `goodhemp-local` runs `node scripts/mcp/goodhemp-mcp.mjs`.  
- **scripts/mcp/goodhemp-mcp.mjs**:  
  - `ALLOWED_SCRIPTS`: includes `build`, `verify:discovery`, `verify:consumer-onboarding`, `verify:phase3d`, `test`, etc.  
  - Uses `execFileAsync(npmCmd, ["run", script], { cwd: REPO_ROOT })` with `npmCmd = process.platform === "win32" ? "npm.cmd" : "npm"`.  
- **Observed**:  
  - `mcp_goodhemp-local_npm_run` with script `verify:discovery` → **"Script not allowed by MCP policy"** (suggests Cursor-side or cached policy may not match repo allowlist).  
  - Script `build` → **"spawn npm ENOENT"** — `execFile` cannot find `npm`/`npm.cmd` in the MCP process environment (no shell PATH).  
- **Fix plan**: Use a shell when running npm (e.g. `exec` with `shell: true` or `cmd /c "npm run ..."` on Windows) so the user’s PATH is used; keep allowlist; add clear error message when npm is missing.

---

## Summary table

| Item | Root cause | Location |
|------|-----------|----------|
| Email not syncing | Already synced in callback when changed. Trigger 101 also updates email (OK). | callback L94–95; 101 ON CONFLICT |
| User display_name/username overwritten | Trigger 101 ON CONFLICT overwrites with COALESCE(EXCLUDED, existing). | 101_profiles_sync_from_auth_users.sql L64–67 |
| NULL profile rows | Onboarding submit / age verify insert without email, display_name, username. | submit route L120–128; age/verify L21–24 |
| White screen /onboarding | QuestionnaireFlow returns null when no currentQuestion (empty questions). | QuestionnaireFlow.tsx L269 |
| MCP cannot run npm | execFile(npm.cmd) ENOENT — npm not in MCP process PATH. | goodhemp-mcp.mjs npm_run handler |
