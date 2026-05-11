# GATE-01 — Age-gate conversion to warning model

**PR:** `fix/age-gate-warning-model-and-middleware-exemptions`
**Build:** #1 (CEO definition-of-launch-ready, top of queue)
**Audit reference:** AUDIT.md Section 1 Top 5 critical issues #1 + Section 9 Fix #1
**Compliance gate change:** YES — requires CEO acknowledgement per directive Rule 6 (Anything affecting payments, auth, or **compliance gates**)

## What is changing

1. **Middleware no longer redirects unverified visitors to `/welcome`.** The `isAgeGateExcludedPath` whitelist and the catch-all redirect block in `middleware.ts:47-97` are deleted. Middleware now does zero age-gate work.
2. **The `<AgeGate />` client component is rewired from a full-screen modal block to a sticky top warning banner.** Pages render underneath the banner so SEO crawlers and curious visitors can read content. Users still see "I am 21+" and "Under 21 — Come back later" as two affirmative choices.
3. **Decline path changes from `https://google.com` redirect to internal `/come-back-later` friendly page.** New page added under `app/come-back-later/page.tsx`. Marked `robots: { index: false, follow: false }`.
4. **Cookie config:**
   - Name: `ghd_age_verified`
   - Value: `true` (simple flag — previous JSON shape kept in `localStorage` for component-side timestamp logic)
   - `Max-Age=31536000` (1 year, was 30 days)
   - `SameSite=Lax`
   - `Secure` flag added (only on HTTPS responses)
   - `path=/`

## Why

Three converging signals demand this change:

1. **AUDIT.md P0:** The middleware's hard-redirect was 307'ing `/pricing`, `/sitemap.xml`, `/robots.txt`, `/community`, `/shop`, `/ask-jax` → `/welcome`. SEO indexing was severed; pricing funnel was severed.
2. **CEO Definition of Launch-Ready Build #1:** "Age gate fix (warning model, not hard block; restrict products by state law)." State restrictions are handled at the product level via `ship_to_states` + `hemp_state_rules` — the audit confirmed those tables exist.
3. **UX:** Sending under-21 users to `google.com` was hostile. A friendly internal page that respects intent and offers hemp education without purchase is the warm exit.

## Blast radius

**What this PR DOES NOT touch:**
- `profiles.age_verified` (DB column) — separate ID verification flow under `/verify-age/*`, unchanged
- `id_verifications` table or `lib/server/idVerification.ts` — unchanged
- Stripe / payment flows — unchanged
- Admin auth or vendor auth — unchanged
- Product-level state-law restrictions (`ship_to_states`, `getRestrictedStatesForProduct`) — unchanged
- The `/age-gate` and `/verify-age` routes — unchanged (those are separate ID-upload flows, not the front-door warning)

**What this PR DOES touch:**
- `middleware.ts` — 51 LOC removed, 12 LOC of explanatory comment added (net -39 LOC)
- `components/AgeGate.tsx` — full rewrite (modal → banner), ~140 LOC
- `app/come-back-later/page.tsx` — NEW file, ~60 LOC
- `__tests__/age-gate.test.tsx` — rewritten to match new banner behavior

**Surfaces affected at runtime:**
- Every page on the site (banner mounts globally via `app/layout.tsx`)
- SEO crawlers will now see real `/sitemap.xml`, `/robots.txt`, `/pricing` content instead of `/welcome` HTML
- Anonymous users land on the URL they typed instead of being bounced to `/welcome`

## Rollback plan

Single revert: `git revert <merge-sha>`. The change is contained to 4 files + 1 deletion. Reverting restores the prior modal + middleware-redirect behavior immediately.

If a soft revert is needed without code touch (e.g., compliance team wants the hard block back fast):
1. Re-add a server-side gate via a Vercel Edge Config flag (would require a follow-up PR — not pre-staged).

## Verification (post-deploy)

CI smoke tests:
- `curl -sIL https://www.goodhempdistro.com/pricing` returns `200` with pricing HTML (not `/welcome` content)
- `curl -sL https://www.goodhempdistro.com/sitemap.xml` returns valid XML starting with `<?xml`
- `curl -sL https://www.goodhempdistro.com/robots.txt` returns valid robots.txt text
- `curl -sL https://www.goodhempdistro.com/come-back-later` returns 200 with "Come back when you're 21" headline

Manual smoke tests (via browser):
- Visit any product page anonymously → banner shows, page content renders underneath
- Click "I am 21+" → banner dismisses, cookie `ghd_age_verified=true; max-age=31536000` set
- Reload → banner does not reappear
- Open new private window, visit any page → banner shows again
- Click "Under 21" → navigates to `/come-back-later`, page renders friendly copy + links

## CEO acknowledgement requested

Per Rule 6 this PR is a compliance-gate change. The directive's Phase 2 instructions greenlit Phase 2 execution, but this specific PR class is named in Rule 6's STOP-AND-ASK list. I've shipped the code on a feature branch and opened the PR — **not merged**. Please confirm with a reply or by hitting "Merge" on the PR.

## Open questions

- **Banner copy** — the legal text reads "By selecting 'I am 21+' you confirm you meet the minimum age requirement in your jurisdiction. State and local laws may further restrict access." Confirm this matches the desired tone, or supply replacement copy.
- **Decline-page copy** — "Come back when you're 21" + an offer to read `/learning-with-jax`. If you'd prefer a different CTA (e.g., newsletter capture for when they turn 21), say the word and I'll adjust.
