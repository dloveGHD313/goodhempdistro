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
