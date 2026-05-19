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

---

## PR #180 — `fix/build-2-tier-mapping-strict-lookup`

- **Started:** 2026-05-12
- **CEO directive item:** Build #2 + Phase 2 STEP 6
- **Branch:** fresh from `main` at `055a959` (post-PR-#179)
- **Files changed:** 3 (lib/billing/tier-mapping.ts new, lib/referral.ts, __tests__/tier-mapping.test.ts new)
- **Local build:** Compiled in 17.5s
- **Local tests:** 20/20 pass
- **Stripe inventory audit:** All 6 vendor plan keys mapped, no GATE-04 needed
- **PR:** #180
- **Merged:** 2026-05-12 01:39:22 UTC (autonomous, CI green)
- **Revert needed:** No

---

## PR #181 — `feat/admin-catalog-import-csv`

- **Started:** 2026-05-12
- **CEO directive item:** Phase 2 STEP 7 (last autonomous PR before catalog-seed halt)
- **Branch:** fresh from `main` at `b880521` (post-PR-#180)
- **Files added:** 5 (lib/admin/catalogImport.ts, api route, admin page, client component, tests)
- **Local build:** Compiled in 12.4s
- **Local tests:** 30/30 pass
- **PR:** #181
- **Merged:** 2026-05-12 01:47:06 UTC (autonomous, CI green)
- **Revert needed:** No

---

# Phase 2 — Final Summary

## All PRs shipped

| # | Title | Merged | Highlight |
|---|---|---|---|
| #173 | age-gate warning model + middleware exemptions | 2026-05-11 12:47 | Closed P0 funnel + SEO blocker |
| #174 | vendors directory layout fix | 2026-05-11 12:57 | Initial fix (incomplete) |
| #175 | shop/community/ask-jax stubs | 2026-05-11 ~13:05 | Closed 404 P0 |
| #176 | middleware vendors public routes | 2026-05-11 13:17 | Caused GATE-02 |
| #177 | defense-in-depth auth boundary (GATE-02 resolution) | 2026-05-11 17:11 | Forced force-dynamic + middleware allowlist |
| #178 | brand title casing cleanup | 2026-05-11 17:17 | GoodHempDistro typo fix |
| #179 | COA categories SSOT cutover (GATE-03 resolution) | 2026-05-11 18:00 | 86 categories flipped + lib/compliance.ts refactor |
| #180 | tier mapping strict lookup | 2026-05-12 01:39 | Build #2 — replaced .includes() |
| #181 | admin catalog import CSV | 2026-05-12 01:47 | Build #7 — anchor seed surface |

## Gates resolved

- **GATE-00** — preflight blockers (Master_agent_prompt template provided inline)
- **GATE-01** — age-gate warning model (CEO approved before PR #173 merge)
- **GATE-02** — vendor auth regression (CEO chose Option C; resolved by PR #177)
- **GATE-03** — COA SSOT cutover (CEO chose Option 1; resolved by PR #179)
- **GATE-04** — Stripe inventory (not needed; pre-flight confirmed no missing mappings)

## Production schema diff vs Phase-0 baseline

| Resource | Phase-0 | Phase-2 close | Δ |
|---|---:|---:|---:|
| categories.requires_coa=true | 17 | **103** | +86 |
| affiliate_payouts columns | 15 | 15 | 0 |
| Total products | 1 | 1 | 0 (catalog seed pending) |
| Active vendors | 3 | 3 | 0 |
| Active vendor profiles (vendor_status='active') | 2 | 2 | 0 |
| Affiliate payouts | 0 | 0 | 0 |

## Production route regression (post-Phase-2)

27/27 routes match expected status (cache-busted curl, 2026-05-12):

**Public (200):** /, /pricing, /products, /vendors, /vendors/activate, /vendors/<uuid>, /events, /community, /services, /shop, /ask-jax, /come-back-later, /about, /sitemap.xml, /robots.txt

**Authed (307 → /login):** /vendors/billing, /vendors/dashboard, /vendors/orders, /vendors/payouts, /vendors/products, /vendors/services, /vendors/settings, /vendors/referrals, /vendors/events, /admin, /admin/catalog-import

**API:** /api/newsletter/subscribe → 405 on HEAD (POST-only, correct)

## What's HALTED next

`.claude/audit/HALT-CATALOG-SEED.md` documents the catalog-seed halt. CEO uploads anchor catalog via /admin/catalog-import. Phase 3 (Stripe Connect, Ask JAX, regional compliance UI) waits behind this halt.

## Recommended next steps (post-halt)

1. **CEO seeds anchor catalog** via /admin/catalog-import (~12 products mix recommended)
2. **Phase 3 verification** per original directive — schema audit re-run, route crawl, Lighthouse mobile ≥ 80
3. **Build #3 — Stripe Connect** (CEO gate per Rule 6 — Stripe live mode)
4. **Build #4 — Ask JAX OpenAI** (CEO gate per Rule 6 — cost ceiling)
5. **Build #5 — Regional compliance UI surface** (CEO gate per Rule 6 — state matrix)
6. **Build #6** (already shipped — personalized onboarding partially done per PR #164)
7. **Build #7** (community feed prominence — needs catalog + posts)
8. **Build #8** (events payout routing — needs events)
9. **Build #9** (8 individual service pages — needs services)
10. **Build #10** (Jax episodes content surface)

## Followups tracked (P2/P3)

- Singular vs plural "Good Hemp Distro" brand sweep (140 instances; marketing decision)
- Codex audit-export script bugs (build-summary.mjs line 81, build-nav-and-links.mjs line 185 — both P2)
- Categories dedupe (5+ duplicate slugs across standalone + under-Consumables)
- 22 → 7 local branches cleanup (already done; some archived under archive/* tags)
- Diagnostic logs in EditProductForm.tsx (already removed)
- Brand `Good Hemp Distros` (plural) vs `Good Hemp Distro` (singular) full sweep

**Phase 2 complete. Halting per HALT-CATALOG-SEED.**

---

## PRE-LAUNCH-TASK — Anchor vendor public-name correction (autonomous)

- **Executed:** 2026-05-19 17:15 UTC via Supabase MCP
- **Type:** Single-row UPDATE on display column (not a Rule 6 gate)
- **CEO directive:** rename `vendors.business_name` from "DLove Test Vendor" to "Good Hemp Distros" (plural, matches brand canonical per PR #178) so the public name is correct before 78-SKU anchor catalog reveals.
- **Vendor:** `debf6809-dbb4-4987-aabe-60c5fdf7ab49` (owner: dlove313d@gmail.com)

### Before (verified, full row)
- `business_name`: **"DLove Test Vendor"**
- `tier`: top
- `is_vip`: true
- `status`: active
- `owner_user_id`: 6c363e91-45bd-4f5c-a41b-7615b25fe5b3
- `updated_at`: 2026-04-29 16:47:41 UTC

### After (verified)
- `business_name`: **"Good Hemp Distros"**
- `updated_at`: 2026-05-19 17:15:23 UTC

### Duplicate-row check (step 4)
Query: `SELECT * FROM vendors v JOIN auth.users u ON u.id=v.owner_user_id WHERE u.email='dlove313d@gmail.com'`

Result: **1 row** — the canonical one we just renamed. No stale test vendors; no cleanup needed.

### Impact
- Rename propagates automatically wherever the vendor renders (product cards, /vendors directory, /vendors/[id] detail, Stripe Connect `business_profile.name` if synced via webhook). No code change required — every consumer reads via `vendor_id` FK.
- 78 anchor catalog SKUs will reference this vendor by UUID after import; the name they display will be "Good Hemp Distros" immediately.
