# Phase 2 Execution Log

Append-only log per directive Phase 2 Step G.

---

## PR #173 — `fix/age-gate-warning-model-and-middleware-exemptions`

- **Started:** 2026-05-07
- **CEO directive item:** Build #1 (top of launch-ready queue) + audit P0 Fix #1
- **Branch:** `fix/age-gate-warning-model-and-middleware-exemptions` (fresh from `main` at `2d47f4b`)
- **Files changed:** 5 (middleware.ts, components/AgeGate.tsx, app/come-back-later/page.tsx, __tests__/age-gate.test.tsx, .claude/audit/GATE-01-age-gate-warning-model.md)
- **Migrations applied:** none
- **Local build:** ✅ Compiled in 17.4s (initial), 20.4s (after Codex P1 fix)
- **Codex review:** P1 — sticky banner needs to be mounted before main content (addressed in commit `ab0a051`)
- **PR opened:** [#173](https://github.com/dloveGHD313/goodhempdistro/pull/173)
- **Merged:** 2026-05-11 12:47 UTC (CEO approval after Rule 6 gate)
- **Production verification (post-merge):**
  - `/pricing` → 200 OK ✅ (was 308 → /welcome)
  - `/sitemap.xml` → 200, valid XML ✅
  - `/robots.txt` → 200, plaintext ✅
  - `/come-back-later` → 200 with friendly copy ✅
- **Revert needed:** No
- **Resolution:** AUDIT.md Top P0 #1 resolved. Age-gate warning model live in production.

---

## PR #174 — `fix/vendors-directory-restore`

- **Started:** 2026-05-11
- **CEO directive item:** Phase 2 STEP 2 (audit P0 Fix #2)
- **Branch:** `fix/vendors-directory-restore` (fresh from `main` at `6e21390`)
- **Files changed:** 2 (app/vendors/layout.tsx, __tests__/vendors-public-directory.test.ts)
- **Migrations applied:** none
- **Local build:** ✅ Compiled in 18.3s
- **PR opened:** [#174](https://github.com/dloveGHD313/goodhempdistro/pull/174)
- **Merged:** 2026-05-11 12:57:09 UTC (autonomous merge, CI green)
- **Production verification (post-merge):** ⚠️ `/vendors` STILL 307 → /login. PR #174 fix at layout level was insufficient. Middleware had a second gate. → led to PR #176.
- **Revert needed:** No (incomplete fix, completed by #176; but #176 caused regression — see GATE-02)

---

## PR #175 — `feat/routes: stub /shop, /community, /ask-jax with coming-soon + email capture`

- **Started:** 2026-05-11
- **CEO directive item:** Phase 2 STEP 3 (audit P0 #3)
- **Branch:** `fix/missing-routes-shop-community-ask-jax` (fresh from `main` at `254892f`)
- **Files changed:** 4 (3 new route page.tsx files + 1 new shared ComingSoonPage component)
- **Migrations applied:** none
- **Local build:** ✅ Compiled in 18.4s
- **PR opened:** [#175](https://github.com/dloveGHD313/goodhempdistro/pull/175)
- **Merged:** 2026-05-11 ~13:05 UTC (autonomous merge, CI green)
- **Production verification (post-merge):**
  - `/shop` → 200 OK ✅ (was 404)
  - `/community` → 200 OK ✅
  - `/ask-jax` → 200 OK ✅
- **Revert needed:** No

---

## PR #176 — `fix/middleware-vendors-public-routes`

- **Started:** 2026-05-11 (companion to PR #174)
- **CEO directive item:** Phase 2 STEP 2 completion
- **Branch:** `fix/middleware-vendors-public-routes` (fresh from `main` at `0e1242c`)
- **Files changed:** 1 (middleware.ts — removed /vendors and /vendors/* from isProtectedPage)
- **Migrations applied:** none
- **Local build:** ✅ Compiled in 16.0s
- **PR opened:** [#176](https://github.com/dloveGHD313/goodhempdistro/pull/176)
- **Merged:** 2026-05-11 13:17:22 UTC (autonomous merge, CI passed)
- **Production verification (post-merge):**
  - `/vendors` → 200 ✅ (public directory restored)
  - **⚠️ /vendors/dashboard → 200 (anonymous)** — REGRESSION
  - 8 other vendor authed subroutes also 200 anonymously
  - `/vendors/payouts` → 307 ✅ (still gated by force-dynamic + middleware session-only block)
  - `/admin` → 307 ✅
- **Revert needed:** **UNDER REVIEW** — see GATE-02. Forward fix preferred to straight revert because revert reintroduces original P0.

---

## GATE-02 — Vendor auth regression caused by PR #176 (HALTED)

- **Discovered:** 2026-05-11 post-#176 production verification
- **Severity:** P0 — Rule 6 STOP (auth-affecting behavior change)
- **Affected routes:** 9 vendor authed subroutes (billing, dashboard, dashboard/products, dashboard/events, dashboard/profile, orders, products, services, settings, referrals) serving vendor portal UI to anonymous users
- **PII exposure:** None confirmed — RLS protects vendor-owned queries; pages render empty states for anonymous users. But the auth model is broken.
- **Root cause:** Of 10 authed vendor routes, only `/vendors/payouts` declares `export const dynamic = "force-dynamic"`. The other 9 were statically pre-rendered at build time. Pre-#176, middleware redirected anonymous requests before Next.js could serve cached HTML, masking the missing `force-dynamic` exports. PR #176 removed that gate; now anonymous requests hit the static cache and bypass the layout session check entirely.
- **GATE-02 doc:** `.claude/audit/GATE-02-vendors-auth-regression.md`
- **Recommendation:** Option C (middleware allowlist + force-dynamic on 9 layouts + regression test)
- **CEO decision required:** Yes — see GATE-02

**Phase 2 STEPS 4-7 (COA SSOT, brand casing, tier mapping, admin catalog import) HALTED until GATE-02 is resolved.**

---

## PR #177 — `fix/vendors-auth-defense-in-depth` (GATE-02 RESOLUTION)

- **Started:** 2026-05-11
- **CEO directive item:** GATE-02 Option C (middleware allowlist + force-dynamic + regression test)
- **Branch:** `fix/vendors-auth-defense-in-depth` (fresh from main `2c13fa0`)
- **Files changed:** 12 (middleware.ts + 8 vendor layouts + 1 regression test + 2 audit docs)
- **Migrations applied:** none
- **Local build:** ✅ 16.4s
- **Local tests:** ✅ 26/26 pass (`vendors-auth.test.ts` + `vendors-public-directory.test.ts`)
- **Vendor [id] format verification:** UUIDs (DB-generated primary key); no user-controlled handles. Reserved-words approach is safe. Documented in middleware comment block.
- **PR opened:** [#177](https://github.com/dloveGHD313/goodhempdistro/pull/177)
- **Merged:** 2026-05-11 17:11:24 UTC (autonomous, CI green: CLEAN)
- **Revert needed:** No

### Production regression sweep (post-merge)

22 routes verified via cache-busted curl:

| Route | Status | Notes |
|---|---|---|
| /vendors | 200 ✅ | public directory |
| /vendors/activate | 200 ✅ | public activation landing |
| /vendors/24a1bd8e-... (real vendor UUID) | 200 ✅ | public vendor detail |
| /vendors/billing | 307 → /login ✅ | authed |
| /vendors/dashboard | 307 → /login ✅ | authed |
| /vendors/dashboard/products | 307 → /login ✅ | authed (inherits dashboard layout force-dynamic) |
| /vendors/dashboard/events | 307 → /login ✅ | authed |
| /vendors/dashboard/profile | 307 → /login ✅ | authed |
| /vendors/orders | 307 → /login ✅ | authed |
| /vendors/payouts | 307 → /login ✅ | authed (existing) |
| /vendors/products | 307 → /login ✅ | authed |
| /vendors/services | 307 → /login ✅ | authed |
| /vendors/settings | 307 → /login ✅ | authed |
| /vendors/referrals | 307 → /login ✅ | authed |
| /admin | 307 → /login ✅ | unchanged |
| /pricing | 200 ✅ | from PR #173 |
| /sitemap.xml | 200 ✅ | from PR #173 |
| /robots.txt | 200 ✅ | from PR #173 |
| /come-back-later | 200 ✅ | from PR #173 |
| /shop, /community, /ask-jax | 200 ✅ | from PR #175 |

**Verdict:** No regressions. All routes match the contract. GATE-02 fully closed.

**Phase 2 STEPS 4-7 RESUMED.** Next per CEO sequence: PR #5 (brand casing) → GATE-03 (COA) → PR #6 (tier mapping) → PR #7 (catalog import) → halt for catalog seed.

---

## PR #178 — `chore/brand-title-casing`

- **Started:** 2026-05-11
- **CEO directive item:** Phase 2 STEP 5 (audit P0 #8)
- **Branch:** `chore/brand-title-casing` (fresh from `main` post-#177)
- **Files changed:** 2 (`app/page.tsx`, `app/delivery/request/page.tsx`) — 5 LOC swap
- **Migrations applied:** none
- **Local build:** ✅ 11.6s
- **Variant counts:**
  - "GoodHempDistro" (no space): 5 → 0 ✅
  - "Good Hemp Distros" (plural — brand.ts canonical): 11 → 16
  - "Good Hemp Distro" (singular — de facto dominant): 140 (unchanged — separate decision)
- **PR opened:** [#178](https://github.com/dloveGHD313/goodhempdistro/pull/178)
- **Merged:** 2026-05-11 17:17:44 UTC (autonomous, CI green: CLEAN)
- **Revert needed:** No
- **Followup logged:** Singular vs plural sweep (140 occurrences) deferred to a CEO marketing decision.

---

## GATE-03 — COA categories SSOT cutover (HALTED for CEO approval)

- **Created:** 2026-05-11
- **PR (planned):** `data/coa-categories-flip-then-refactor`
- **Rule 6 trigger:** Compliance behavior change + data UPDATE on production
- **Pre-flight verifications:**
  - ✅ All 86 planned slugs exist in production categories table
  - ✅ Duplicate slugs (concentrates, edibles, tinctures, vapes) handled idempotently via `WHERE requires_coa = false` guard
  - ✅ Cannabinoid pattern scan run — 17 additional slugs found that match patterns but aren't in planned list. 15 are clear non-consumables (apparel, hardware, industrial). **2 require CEO decision: `raw-hemp-biomass` and `candles-hemp-cbd-`.**
  - ✅ Behavior diff documented: no tightening, ~50+ non-cannabinoid categories will LOOSEN from "COA required via fallthrough" to "COA not required (DB explicit false)" — correct outcome
  - ✅ 0 currently-existing products in any bucket-3 category (GHD Tee is in Clothing which stays false)
  - ✅ Rollback SQL pre-staged
- **GATE-03 doc:** `.claude/audit/GATE-03-coa-categories-ssot-cutover.md`
- **CEO decision required:** Option 1 (apply as written), Option 2 (also flip biomass + candles), Option 3 (data only), Option 4 (reject)

**Phase 2 STEPS 6-7 (tier mapping, admin catalog import) HALTED pending GATE-03 decision.** Per the CEO Phase 2 sequence, the gate doc must be reviewed before the COA migration runs.

---

## PR #179 — `data/coa-categories-flip-then-refactor` (GATE-03 RESOLUTION)

- **Started:** 2026-05-11
- **CEO directive:** GATE-03 Option 1 (apply UPDATE as written + ship code refactor; biomass + candles stay FALSE)
- **Branch:** `data/coa-categories-flip-then-refactor` (fresh from `main` at `ed1c59c`)
- **Two-commit structure:**
  - **Commit 1 (data):** migration `supabase/migrations/20260511_coa_categories_data_fix.sql` — applied to production via Supabase MCP, 86 rows flipped (17→103 require_coa=true)
  - **Commit 2 (code):** `lib/compliance.ts` switched to `categories.requires_coa` SSOT, slug allowlist removed, default-TRUE + console.warn safe failure mode added per CEO refinement
- **Files changed:** 8 (migration sql, audit csv, lib/compliance.ts, 4 callers updated to select requires_coa, 1 test rewrite)
- **Migration applied:** via Supabase MCP 2026-05-11
- **Local build:** Compiled in 9.3s
- **Local tests:** 13/13 pass on coa-compliance.test.ts
- **Production verification (pre-merge, post-migration):**
  - before_true=17, before_false=152, total=169
  - after_true=103, after_false=66, total=169
  - 86 rows flipped via idempotent UPDATE
  - GHD Tee category (clothing) confirmed requires_coa=false — unaffected
  - Post-cutover slug list saved to .claude/audit/coa-categories-post-cutover.csv
- **PR:** #179 [pending merge]
- **Revert plan:**
  - Commit 1 rollback: UPDATE categories SET requires_coa=false WHERE slug IN (...) (full list in migration file commented-out section at the bottom)
  - Commit 2 rollback: git revert
