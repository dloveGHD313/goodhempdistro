# GATE-02 — Vendor auth regression caused by PR #176

**Severity:** P0 (auth-affecting compliance regression — Rule 6 STOP)
**Discovered:** 2026-05-11 post-PR-#176 production verification
**Status:** Investigation complete. **No code pushed.** Awaiting CEO decision.

## What happened

PR #176 (`fix(middleware): remove /vendors from isProtectedPage`) was intended as a follow-up to PR #174's incomplete fix of the public `/vendors` directory. The audit confirmed each authenticated subroute had its own layout-level `redirect()`, so I removed the middleware gate believing the security posture would stay intact via layout-level checks alone.

**That assumption was wrong.** Of 10 authenticated vendor subroutes, only `/vendors/payouts` declares `export const dynamic = "force-dynamic"`. The other **9 routes have no dynamic opt-in**, so Next.js statically pre-renders them at build time. With middleware gating removed, anonymous requests now hit the **pre-rendered static HTML** and the layout session check never runs at request time.

## Affected routes (verified via cache-busted curl)

Status / Location captured 2026-05-11, fresh request with unique `?_cb=` param:

| Route | Status | Expected | Regression? |
|---|---|---|---|
| /vendors | 200 (none) | 200 (public) | ✅ correct |
| /vendors/billing | **200 (none)** | 307 → /login | ❌ **BYPASSED** |
| /vendors/dashboard | **200 (none)** | 307 → /login | ❌ **BYPASSED** |
| /vendors/dashboard/products | **200 (none)** | 307 → /login | ❌ **BYPASSED** |
| /vendors/dashboard/events | **200 (none)** | 307 → /login | ❌ **BYPASSED** |
| /vendors/dashboard/profile | **200 (none)** | 307 → /login | ❌ **BYPASSED** |
| /vendors/orders | **200 (none)** | 307 → /login | ❌ **BYPASSED** |
| /vendors/payouts | 307 → /login?next=/vendors/payouts | 307 → /login | ✅ correct (has `force-dynamic`) |
| /vendors/products | **200 (none)** | 307 → /login | ❌ **BYPASSED** |
| /vendors/services | **200 (none)** | 307 → /login | ❌ **BYPASSED** |
| /vendors/settings | **200 (none)** | 307 → /login | ❌ **BYPASSED** |
| /vendors/referrals | **200 (none)** | 307 → /login | ❌ **BYPASSED** |
| /admin | 307 → /login?redirect=/admin | 307 → /login | ✅ correct (still in middleware list) |

Body sniff of anonymous `/vendors/dashboard` returns 29KB of vendor-dashboard HTML containing the string "My Events" — page genuinely rendered, not just nav chrome. Title is the global "Good Hemp Distros - Community Marketplace" (root layout default), suggesting the dashboard's own metadata didn't get applied — consistent with static pre-rendering where the layout never ran.

**No PII exposure verified yet.** The dashboard page server-side queries vendor-owned data scoped to the authed user. With no auth, Supabase queries either return empty arrays (RLS-protected) or error rows. UI renders empty states — but the unauthenticated client can still see the layout structure / vendor portal navigation / labels. **It is reading dashboard chrome, not other vendors' data, but the security model is broken.**

## Root cause

Two converging Next.js / Supabase patterns:

1. **Next.js 15 statically pre-renders any route segment without `dynamic = "force-dynamic"` or runtime APIs (`cookies()`, `headers()`, etc.) detected at build.** Layout-level `redirect()` calls aren't sufficient to mark a route as dynamic — they only RUN if the layout executes at request time.

2. **Supabase SSR cookie API doesn't force dynamic rendering at the route level even though it reads `cookies()`** under the hood. The vendor layouts call `await supabase.auth.getSession()` which internally reads cookies — that should mark the route dynamic. But because the call is inside a layout (not a page), Next's static analysis evidently doesn't propagate the dynamic signal to the page level. Confirmed empirically by the route audit.

Pre-PR-#176, middleware redirected anonymous requests to `/login` before Next.js could serve cached HTML. The middleware gate was unintentionally compensating for the missing `force-dynamic` exports.

## Proposed fixes

### Option A — Selective middleware allowlist (defense layer 1)

Re-add `/vendors` and `/vendors/*` to middleware's `isProtectedPage`, but with explicit allowlist for the three public paths:

```ts
const isPublicVendorPath =
  pathname === "/vendors" ||                              // directory
  /^\/vendors\/[0-9a-f-]{36}$/i.test(pathname) ||          // detail by UUID
  pathname === "/vendors/activate";                        // post-application landing

const isProtectedPage = (
  pathname === "/dashboard" ||
  pathname.startsWith("/dashboard/") ||
  pathname === "/account" ||
  pathname.startsWith("/account/") ||
  pathname === "/checkout" ||
  pathname.startsWith("/checkout/") ||
  (pathname.startsWith("/vendors") && !isPublicVendorPath) ||
  pathname === "/driver/dashboard" ||
  pathname.startsWith("/driver/dashboard/") ||
  pathname === "/admin" ||
  pathname.startsWith("/admin/")
);
```

**Pros:**
- Restores immediate security at the middleware edge (no static-cache window).
- Public `/vendors` directory + `/vendors/[id]` + `/vendors/activate` still accessible.

**Cons:**
- Regex for `/vendors/[id]` UUID is brittle if vendor IDs ever change format (currently UUID v4).
- Two-layer defense conceptually overlaps with layout checks.

### Option B — Force dynamic + trust layouts (defense layer 2)

Add `export const dynamic = "force-dynamic";` to every authenticated vendor route's `layout.tsx` (or its page). Keep middleware NOT gating /vendors/*. Add a regression test asserting anonymous requests redirect.

**Pros:**
- Single source of auth truth (layouts).
- Doesn't reintroduce middleware path matching.

**Cons:**
- Easy to miss when adding a new authed route → silent reintroduction of this regression.
- Static pre-rendering disabled even for cases where it'd be safe (we don't currently use ISR/SSG for vendor routes, but might want to).
- Requires touching 9 files instead of 1.

### Option C — **RECOMMENDED — Both A and B (defense in depth)**

Apply A (middleware allowlist) AND B (force-dynamic + regression test) in one PR.

**Pros:**
- Middleware blocks at edge — fastest, cheapest.
- Force-dynamic ensures layout checks fire if middleware is changed later.
- Regression test pins the contract for future PRs.

**Cons:**
- More files changed (1 middleware + ~9 layout files + 1 test).
- Slight complexity (two-layer defense).

**This is the standard pattern for Next.js + Supabase. Recommend Option C.**

## Blast radius if we revert PR #176

`git revert <PR-#176-merge>` would:
- ✅ Restore auth on all 9 currently-bypassed routes immediately.
- ❌ Re-break the public `/vendors` directory (audit P0 Fix #2 — back to 307 → /login).
- ❌ Re-break `/vendors/[id]` and `/vendors/activate` (publics).

So **straight revert is NOT acceptable** — it brings back the original P0 we were fixing. We need a forward fix.

## Rollback plan for the proposed fix

If Option C ships and causes a problem:
- `git revert <new-merge>` removes the middleware allowlist + force-dynamic exports.
- That leaves us in current state (auth regression but public directory works).
- Followed by manual revert of PR #176 if needed to restore full auth lockdown.

So the fix is reversible, with a sequence: revert new fix → optionally revert #176.

## CEO decision requested

1. **Approve Option C** (recommended): I open PR #177 with middleware allowlist + force-dynamic exports on the 9 authed layouts + a regression test. Estimated change: ~12 files, ~80 LOC.
2. **Approve Option A only:** I open PR #177 with just the middleware allowlist. Smaller change (1 file).
3. **Approve Option B only:** I open PR #177 with just the force-dynamic exports + regression test. No middleware change.
4. **Revert PR #176 immediately** (re-breaks public /vendors, but locks down auth): one-line revert; would need a follow-up PR to fix public directory differently.

Per Rule 6, halting until CEO chooses. Current production posture: 9 routes serving vendor portal UI chrome to anonymous users with no data exposure (RLS-protected) but with auth model broken.
