# GoodHempDistro — Full Build Summary (Phases 0–9) & CEO Verification Checklist

**Branch:** `feat/platform-finish-loyalty-affiliates-vendorref-commissions-admin`  
**Scope:** Platform commissions, admin revenue/analytics, loyalty, affiliates (ledger + Connect + payouts), vendor referrals (referrers + signup/first-sale + payouts), discovery/leads/reviews/ops.

---

## Phase 0–9 at a Glance

| Phase | Name | Created / Changed | Migrations |
|-------|------|-------------------|------------|
| **0** | Baseline | QA_MASTER.md; verified build + vendor product edit (getSession, cookies). | — |
| **1** | Products edit parity | Edit page: status/banner/delete; services API getSession(); qa-products-parity.md. | — |
| **2** | Orders foundation | 067 migration (orders.currency, order_items extensibility, RLS); create-session + webhook; /account/orders, /vendors/orders. | 067, (070 if RLS fix needed) |
| **3** | Platform commissions | 068 migration (platform_fee_rules, order_items fees); lib/platformFees.ts; webhook applies fees on paid. | 068 |
| **4** | Vendor Stripe Connect | 069 migration (vendor_connect_accounts); create-account, onboard-link, status APIs; /vendors/payouts. | 069 |
| **5** | Admin revenue dashboard | admin/analytics APIs (overview, timeseries, top-vendors, top-items); /admin/analytics; link from admin products. | — |
| **6** | Loyalty | /account/loyalty (balance, events); link from account; existing webhook + consumer_loyalty. | — |
| **7** | Affiliates | 071 migration (ledger, payouts, reward_rules, Connect); /r/[code]; Connect + ledger APIs; /affiliates/portal; admin payouts queue. | 071 |
| **8** | Vendor referrals | 072 migration (referral_code, referrers, referrals, ledger, payouts); /vr/[code]; vendor registration + approve + first-sale; /vendors/referrals; admin payout queue. | 072 |
| **9** | Discovery / leads / reviews / ops | qa-phase9 doc; QA_MASTER test URLs. No new code. | — |

---

## Part 1 — Executive Summary

### What Was Built (High Level)

| Area | Delivered |
|------|-----------|
| **Commerce** | Orders + order_items (currency, item_type, vendor_user_id, line_total); checkout create-session + webhook marks paid; consumer `/account/orders`, vendor `/vendors/orders`. |
| **Revenue** | Platform fee rules by vendor tier + item type; fees and vendor_net persisted on order_items when order is paid; admin analytics (GMV, platform revenue, timeseries, top vendors/items). |
| **Vendor payouts** | Stripe Connect Express for vendors; `/vendors/payouts` (Connect onboarding); payouts used for vendor referral rewards (and optional sales net). |
| **Loyalty** | Existing consumer_loyalty + webhook awarding purchase points; `/account/loyalty` (balance, lifetime earned, recent events). |
| **Affiliates** | Ledger (earnings per referral), payouts (request → admin approve → Stripe Transfer), Stripe Connect for affiliates; `/r/[code]` redirect; `/affiliate` + `/affiliates/portal`; admin payout queue. |
| **Vendor referrals** | Referrers (one code per vendor), signup + first_sale rewards, ledger + payouts; `/vr/[code]` → vendor registration; `/vendors/referrals`; admin vendor-referral payout queue. |
| **Discovery / Leads / Reviews / Ops** | No new code; documented existing `/discover`, reviews (APIs + UI), service inquiries, admin audit/moderation/analytics/queues. |

### New Supabase Migrations (Run in Order)

- **067** — Orders foundation (currency, order_items extensibility, RLS).
- **068** — Platform fee rules + order_items.platform_fee_cents, vendor_net_cents.
- **069** — Vendor Connect accounts table.
- **070** — (Optional) Fix orders admin RLS if 067 used `profiles.is_admin` and that column doesn’t exist — use `admin_users` instead.
- **071** — Affiliates Phase 7: affiliates + affiliate_referrals (if missing), stripe_account_id, affiliate_reward_rules, affiliate_ledger, affiliate_payouts, admin RLS, payout_id on ledger.
- **072** — Vendor referrals Phase 8: vendor_applications.referral_code, vendor_referrers, vendor_referrals, vendor_referral_reward_rules, vendor_referral_ledger, vendor_referral_payouts, admin RLS.

### Key Environment / Docs

- **Vercel:** `docs/VERCEL_ENV_VARS_REQUIRED.md` — NEXT_PUBLIC_SITE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY, etc.
- **Supabase SQL:** `docs/SUPABASE_SQL_TO_RUN.sql` — concatenated reference for 067–072 (run full migrations from `supabase/migrations/` in order).
- **Hard rules:** API auth uses `getSession()`; server components call internal APIs with forwarded cookies; base URL from headers or NEXT_PUBLIC_SITE_URL.

---

## Part 2 — Phase-by-Phase: What Was Created / Changed / Built

### Phase 0 — Baseline

- **Created:** `docs/QA_MASTER.md` (baseline + test URLs + phase pointers).
- **Verified:** `npm run build` passes; vendor product edit flow (API uses getSession, edit page loads via internal API with cookies).
- **No schema or app behavior changes.**

### Phase 1 — Products Edit Parity

- **Changed:**  
  - `app/vendors/products/[id]/edit/page.tsx` — status, submitted_at, rejection_reason; approved banner.  
  - `app/vendors/products/[id]/edit/EditProductForm.tsx` — delete product (confirm step, redirect to `/vendors/products`); approval banner when status === 'approved'.  
  - `app/api/vendors/services/[id]/route.ts` — uses getSession(); removed debug log.  
- **Created:** `docs/qa-products-parity.md`.  
- **No new migrations.**

### Phase 2 — Orders Foundation

- **Created:**  
  - Migration `067_orders_foundation.sql` — orders.currency; order_items (item_type, item_id, vendor_user_id, line_total_cents, fulfilled_at); product_id nullable; RLS insert + admin read (admin_users).  
  - `app/api/checkout/create-session/route.ts` — getSession(); creates order + order_items with item_type, item_id, vendor_user_id, line_total_cents.  
  - `app/account/orders/page.tsx`, `app/vendors/orders/page.tsx` — list consumer/vendor orders.  
  - `docs/qa-commerce-orders.md`.  
- **Changed:**  
  - `app/orders/page.tsx` — getSession().  
  - `app/account/page.tsx` — "My Orders" → `/account/orders`.  
  - `app/vendors/dashboard/page.tsx` — "View orders" → `/vendors/orders`.  
- **Webhook:** checkout.session.completed / payment_intent.succeeded marks order paid (existing behavior; order_id in metadata).

### Phase 3 — Platform Commissions

- **Created:**  
  - Migration `068_platform_fees.sql` — platform_fee_rules (vendor_plan_type, item_type, fee_bps); order_items.platform_fee_cents, vendor_net_cents; seed rules.  
  - `lib/platformFees.ts` — applyPlatformFeesToOrder().  
  - `docs/qa-platform-fees.md`.  
- **Changed:** `app/api/webhooks/stripe/route.ts` — after order marked paid, calls applyPlatformFeesToOrder(admin, orderId) in checkout.session.completed and payment_intent.succeeded.  
- **No new UI.**

### Phase 4 — Vendor Stripe Connect

- **Created:**  
  - Migration `069_vendor_connect.sql` — vendor_connect_accounts (user_id, stripe_account_id, charges_enabled, payouts_enabled).  
  - `app/api/vendors/connect/create-account/route.ts` (POST).  
  - `app/api/vendors/connect/onboard-link/route.ts` (POST).  
  - `app/api/vendors/connect/status/route.ts` (GET).  
  - `app/vendors/payouts/page.tsx` + `PayoutsClient.tsx`.  
- **Changed:** `app/vendors/dashboard/page.tsx` — "Payouts (Stripe Connect)" link.

### Phase 5 — Admin Revenue Dashboard

- **Created:**  
  - `app/api/admin/analytics/overview/route.ts` (GET).  
  - `app/api/admin/analytics/timeseries/route.ts` (GET).  
  - `app/api/admin/analytics/top-vendors/route.ts` (GET).  
  - `app/api/admin/analytics/top-items/route.ts` (GET).  
  - `app/admin/analytics/page.tsx` + `AnalyticsClient.tsx`.  
  - `docs/qa-admin-analytics.md`.  
- **Changed:** `app/admin/products/page.tsx` — "Analytics" link.  
- **Auth:** All analytics routes use requireAdminUsers(req).

### Phase 6 — Loyalty

- **Created:**  
  - `app/account/loyalty/page.tsx` — balance, lifetime earned, recent activity (GET /api/consumer/loyalty).  
  - `docs/qa-loyalty.md`.  
- **Changed:** `app/account/page.tsx` — "Loyalty" link.  
- **Existing:** consumer_loyalty, consumer_loyalty_events, awardPurchasePointsForOrder in webhook (unchanged).

### Phase 7 — Affiliates (Ledger, Payouts, Connect, Portal)

- **Created:**  
  - Migration `071_affiliates_phase7.sql` — affiliates + affiliate_referrals (if missing), affiliates.stripe_account_id, updated_at; affiliate_reward_rules; affiliate_ledger; affiliate_payouts; admin RLS; affiliate_ledger.payout_id.  
  - `app/r/[code]/page.tsx` — redirect to `/?ref=code`.  
  - `app/api/affiliates/connect/create-account/route.ts`, `onboard-link/route.ts`, `status/route.ts`.  
  - `app/api/affiliates/ledger/route.ts`, `balance/route.ts`, `payouts/route.ts`, `payouts/request/route.ts`.  
  - `app/api/admin/affiliates/payouts/route.ts`, `payouts/[id]/approve/route.ts`.  
  - `app/affiliates/portal/page.tsx` + `AffiliatePortalClient.tsx`.  
  - `app/admin/affiliates/payouts/page.tsx` + `AffiliatePayoutsClient.tsx`.  
  - `docs/qa-affiliates-phase7.md`.  
- **Changed:**  
  - `app/api/webhooks/stripe/route.ts` — handleReferralTracking creates affiliate_ledger (available) instead of affiliate_payouts; uses admin client.  
  - `app/affiliate/page.tsx` — "Earnings & payouts →" to `/affiliates/portal`.  
  - `app/admin/affiliates/page.tsx` — "Payout queue" link.

### Phase 8 — Vendor Referrals

- **Created:**  
  - Migration `072_vendor_referrals_phase8.sql` — vendor_applications.referral_code; vendor_referrers; vendor_referrals; vendor_referral_reward_rules; vendor_referral_ledger; vendor_referral_payouts; admin RLS; ledger.payout_id.  
  - `lib/vendorReferral.ts` — capture/get/clear vendor ref code (cookie ghd_vendor_ref).  
  - `app/vr/[code]/page.tsx` — redirect to `/vendor-registration?vr=code`.  
  - `app/api/vendors/referrals/code/route.ts`, `ledger/route.ts`, `balance/route.ts`, `payouts/route.ts`, `payouts/request/route.ts`.  
  - `app/api/admin/vendor-referrals/payouts/route.ts`, `payouts/[id]/approve/route.ts`.  
  - `app/vendors/referrals/page.tsx` + `VendorReferralsClient.tsx`.  
  - `app/admin/vendor-referrals/payouts/page.tsx` + `VendorReferralPayoutsClient.tsx`.  
  - `docs/qa-vendor-referrals-phase8.md`.  
- **Changed:**  
  - `app/api/vendors/create/route.ts` — accepts vr_code in body; stores referral_code on vendor_applications.  
  - `app/vendor-registration/VendorForm.tsx` — captures vr from query; sends vr_code in create body.  
  - `app/api/admin/vendors/[id]/route.ts` — on approve, if application has referral_code, creates vendor_referrals (signup) + vendor_referral_ledger.  
  - `app/api/webhooks/stripe/route.ts` — awardVendorReferralFirstSale(admin, orderId) after order paid (first paid order for referred vendor → first_sale + ledger).  
  - `app/vendors/dashboard/page.tsx` — "Referrals" link.  
  - `app/admin/vendors/page.tsx` — "Vendor referral payouts" link.

### Phase 9 — Discovery / Leads / Reviews / Ops

- **Created:**  
  - `docs/qa-phase9-discovery-leads-reviews.md` — documents existing discover, reviews, inquiries, admin ops.  
- **Changed:** `docs/QA_MASTER.md` — Phase 9 checklist + test URLs (Discover, Reviews, Service leads).  
- **No new migrations or app code.**

---

## Part 3 — CEO Manual Verification Checklist

Use this checklist to verify behavior end-to-end. Check off each item after testing; note any failures or changes needed.  
**How to give feedback:** Note the **item ID** (e.g. D2, J6), what you saw, and what you expected — see **Feedback** at the end.

---

### A. Baseline & Build

- [ ] **A1.** Run `npm run build` — completes successfully (Next.js 16.x, Turbopack).  
  _Pass:_ Build finishes with no errors.
- [ ] **A2.** Run `npm run typecheck` (if present) — no type errors.  
  _Pass:_ No TypeScript errors reported.
- [ ] **A3.** Confirm branch: `feat/platform-finish-loyalty-affiliates-vendorref-commissions-admin`.  
  _Pass:_ `git branch --show-current` matches (or you are on main with these changes merged).

---

### B. Supabase Migrations

- [ ] **B1.** Migrations 067, 068, 069 have been run (orders, platform_fee_rules, order_items fees columns, vendor_connect_accounts).  
  _Pass:_ No migration errors; tables/columns exist in Supabase.
- [ ] **B2.** If orders admin RLS failed on profiles.is_admin: migration 070 (admin_users for orders) has been run.  
  _Pass:_ Admin can read all orders (or 067 was run with admin_users from the start).
- [ ] **B3.** Migration 071 has been run (affiliates/affiliate_referrals if missing, stripe_account_id, affiliate_reward_rules, affiliate_ledger, affiliate_payouts, admin RLS, payout_id on ledger).  
  _Pass:_ affiliate_ledger, affiliate_payouts, affiliate_reward_rules exist; RLS allows admin.
- [ ] **B4.** Migration 072 has been run (vendor_applications.referral_code, vendor_referrers, vendor_referrals, vendor_referral_reward_rules, vendor_referral_ledger, vendor_referral_payouts, admin RLS).  
  _Pass:_ Tables exist; vendor_applications has referral_code; admin can manage payouts.

---

### C. Environment & Config

- [ ] **C1.** Vercel (or host) has NEXT_PUBLIC_SITE_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY set (see docs/VERCEL_ENV_VARS_REQUIRED.md).  
  _Pass:_ Env vars present; checkout/webhook/Connect work in deployed env.
- [ ] **C2.** Admin access: your user is in `admin_users` (or requireAdmin allowlist) for admin routes and payout approvals.  
  _Pass:_ You can open /admin/analytics and approve payouts.

---

### D. Phase 1 — Product Edit Parity

- [ ] **D1.** As vendor: open `/vendors/dashboard/products` or `/vendors/products`, click Edit on a product → `/vendors/products/[id]/edit` loads (no false login redirect).  
  _Pass:_ Edit page shows product form; no unexpected redirect to login.
- [ ] **D2.** Edit a product with status **approved** → banner: "This product is approved. Changes may require re-approval."  
  _Pass:_ Banner text appears above the form when product is approved.
- [ ] **D3.** On edit page: "Delete product" → confirmation ("Yes, delete" / "Cancel") → "Yes, delete" deletes and redirects to `/vendors/products`.  
  _Pass:_ Confirm step appears; "Yes, delete" removes product and redirects; "Cancel" keeps form.
- [ ] **D4.** Change name/price and Save → success; redirect to dashboard (or expected target).  
  _Pass:_ Save succeeds and redirects; changes visible on list/detail.
- [ ] **D5.** Log out → open edit URL → redirect to login with return URL.  
  _Pass:_ Unauthenticated user is sent to login with return URL preserved.

---

### E. Phase 2 — Orders

- [ ] **E1.** As consumer: add product to cart / go through checkout (create session) → complete payment (Stripe test mode) → order appears on `/account/orders` with status paid.  
  _Pass:_ Order shows in list with "paid" (or equivalent); line items visible.
- [ ] **E2.** As vendor: open `/vendors/orders` → orders that include your products appear.  
  _Pass:_ Only orders containing that vendor’s items are listed.
- [ ] **E3.** As admin: can see all orders (e.g. via direct DB or future admin orders UI if present).  
  _Pass:_ Admin can access full order set (DB or UI).
- [ ] **E4.** Unauthenticated POST to create-session (or no session) → 401.  
  _Pass:_ API returns 401 without valid session.
- [ ] **E5.** Account page has "My Orders" (or equivalent) linking to `/account/orders`.  
  _Pass:_ Link exists and goes to consumer orders list.

---

### F. Phase 3 — Platform Fees

- [ ] **F1.** Create and pay a product order (test mode).
- [ ] **F2.** In Supabase: `order_items` for that order have `platform_fee_cents` and `vendor_net_cents` set; platform_fee_cents + vendor_net_cents = line_total_cents (for that line).

---

### G. Phase 4 — Vendor Connect

- [ ] **G1.** As vendor: open `/vendors/payouts` → page loads (no redirect to login if session valid).  
  _Pass:_ Payouts page shows Connect status / onboarding CTA.
- [ ] **G2.** Click "Connect with Stripe" → create-account + onboard-link called → redirect to Stripe Connect onboarding.  
  _Pass:_ Redirect to Stripe hosted onboarding (Express).
- [ ] **G3.** Complete Stripe Connect onboarding (test) → return to `/vendors/payouts` → status shows connected; charges_enabled / payouts_enabled as per Stripe.  
  _Pass:_ Return URL works; page shows "Connected" and capability flags.
- [ ] **G4.** Vendor dashboard shows "Payouts (Stripe Connect)" (or similar) linking to `/vendors/payouts`.  
  _Pass:_ Dashboard has link to payouts page.

---

### H. Phase 5 — Admin Analytics

- [ ] **H1.** As admin: open `/admin/analytics` → overview cards load (GMV, platform revenue, orders count, AOV or equivalent).
- [ ] **H2.** Timeseries and top vendors / top items tables (or sections) load.
- [ ] **H3.** As non-admin: open `/admin/analytics` → redirect or 403.
- [ ] **H4.** Admin products page has "Analytics" link to `/admin/analytics`.

---

### I. Phase 6 — Loyalty

- [ ] **I1.** As consumer (with subscription): open `/account/loyalty` → balance and recent activity (or "no activity") display.  
  _Pass:_ Balance and event list (or empty state) visible.
- [ ] **I2.** Account page has "Loyalty" (or equivalent) linking to `/account/loyalty`.  
  _Pass:_ Link exists and opens loyalty page.
- [ ] **I3.** After a paid product order: loyalty balance increases (webhook awards purchase points); refresh `/account/loyalty` to see update.  
  _Pass:_ New points and event appear after a paid order (may take a few seconds).

---

### J. Phase 7 — Affiliates

- [ ] **J1.** Open `/r/ABC123` (or any valid code) → redirects to `/?ref=ABC123`.  
  _Pass:_ Browser lands on home with `ref=ABC123` in URL.
- [ ] **J2.** As logged-in user: open `/affiliate` → get referral code and referral link; "Earnings & payouts →" links to `/affiliates/portal`.  
  _Pass:_ Code/link shown; link goes to portal.
- [ ] **J3.** Open `/affiliates/portal` (as affiliate) → ledger, available balance, "Request payout", Stripe Connect section load.  
  _Pass:_ All sections visible (can be empty).
- [ ] **J4.** Request payout (amount ≤ available) → payout appears in list with status "requested".  
  _Pass:_ New row in payouts list with status requested.
- [ ] **J5.** Connect with Stripe (affiliate Connect) from portal → onboarding redirect and return work.  
  _Pass:_ Stripe Connect onboarding completes and return URL works.
- [ ] **J6.** As admin: open `/admin/affiliates/payouts` → list of payouts; "Approve" on a requested payout (affiliate has Connect) → success; payout status → paid; ledger entries marked paid.  
  _Pass:_ Approve succeeds; payout shows paid; ledger entries updated (check DB if needed).
- [ ] **J7.** Admin affiliates page has "Payout queue" (or similar) to `/admin/affiliates/payouts`.  
  _Pass:_ Link present and works.
- [ ] **J8.** Subscription checkout with affiliate_code in metadata → after payment, affiliate_ledger gets new "available" entry (check DB or portal after a test signup).  
  _Pass:_ New ledger row (status available) after referred subscription payment.

---

### K. Phase 8 — Vendor Referrals

- [ ] **K1.** Open `/vr/XYZ789` → redirects to `/vendor-registration?vr=XYZ789`.  
  _Pass:_ Registration page opens with `vr=XYZ789` in URL.
- [ ] **K2.** As vendor: open `/vendors/referrals` → referral code and link displayed; ledger, balance, request payout; link to Connect (e.g. "Connect Stripe for payouts").  
  _Pass:_ All sections visible; shareable link shown.
- [ ] **K3.** Request payout (amount ≤ available) → payout appears with status "requested".  
  _Pass:_ Payout list shows new requested payout.
- [ ] **K4.** As admin: open `/admin/vendor-referrals/payouts` → list of vendor referral payouts; "Approve" for a requested one (vendor has Connect) → success; payout → paid.  
  _Pass:_ Approve succeeds; payout status becomes paid.
- [ ] **K5.** Admin vendors page has "Vendor referral payouts" (or similar) to `/admin/vendor-referrals/payouts`.  
  _Pass:_ Link present and works.
- [ ] **K6.** **Signup attribution:** Open vendor registration with `?vr=REFERRER_CODE` (or cookie set from /vr/REFERRER_CODE). Submit application with ref present → application has referral_code in DB. Admin approves application → vendor_referrals row (event_type signup) and vendor_referral_ledger "available" entry created for referrer.  
  _Pass:_ application.referral_code stored; after approve, referrer has signup referral + ledger entry.
- [ ] **K7.** **First-sale:** Referred vendor (from K6) receives first paid product order → after webhook, vendor_referrals (event_type first_sale) and vendor_referral_ledger entry created for referrer (check DB or referrer’s `/vendors/referrals` ledger).  
  _Pass:_ Referrer sees first_sale reward and new ledger entry after referred vendor’s first paid order.

---

### L. Phase 9 — Discovery, Leads, Reviews, Ops

- [ ] **L1.** Open `/discover` → recommendations (vendors/products/services/events) or "no results" / sign-up CTA when not logged in.
- [ ] **L2.** Nav shows "Discover" (or "🧭 Discover") linking to `/discover`.
- [ ] **L3.** Open a product detail page → reviews section present; product list pages show rating badges where implemented.
- [ ] **L4.** Open vendor/event/service detail pages → reviews section present where implemented.
- [ ] **L5.** As vendor: open `/vendors/services/inquiries` → service leads list (or empty).
- [ ] **L6.** As admin: open `/admin/inquiries` → inquiries list and actions work.
- [ ] **L7.** As admin: `/admin/audit` — audit log loads; `/admin/moderation` — reports/moderation; `/admin/products/queue` — pending_review products; `/admin/affiliates/payouts` and `/admin/vendor-referrals/payouts` — as in J6 and K4.

---

### M. Security & Hard Rules

- [ ] **M1.** No API route that should be authenticated uses only getUser() where getSession() is required (prefer getSession() for SSR/cookies).
- [ ] **M2.** Admin-only routes (analytics, payout approve, etc.) enforce admin (e.g. requireAdmin or requireAdminUsers); non-admin gets 403 or redirect.
- [ ] **M3.** No secrets or full tokens in client-visible logs or responses.

---

### N. Docs & Reference

- [ ] **N1.** `docs/QA_MASTER.md` — test URLs and phase checklist match this summary.  
  _Pass:_ QA_MASTER links to phase docs and lists key URLs.
- [ ] **N2.** `docs/SUPABASE_SQL_TO_RUN.sql` — includes 067–072 reference/notes (run full migrations from repo).  
  _Pass:_ File exists; run migrations from supabase/migrations/ in order for source of truth.
- [ ] **N3.** `docs/VERCEL_ENV_VARS_REQUIRED.md` — lists required env vars for deploy.  
  _Pass:_ NEXT_PUBLIC_SITE_URL, Stripe, Supabase keys documented.

---

## Part 4 — Key Files Reference

| Purpose | Path |
|--------|------|
| QA master | `docs/QA_MASTER.md` |
| Phase 1 parity | `docs/qa-products-parity.md` |
| Phase 2 orders | `docs/qa-commerce-orders.md` |
| Phase 3 fees | `docs/qa-platform-fees.md` |
| Phase 5 analytics | `docs/qa-admin-analytics.md` |
| Phase 6 loyalty | `docs/qa-loyalty.md` |
| Phase 7 affiliates | `docs/qa-affiliates-phase7.md` |
| Phase 8 vendor referrals | `docs/qa-vendor-referrals-phase8.md` |
| Phase 9 discovery/ops | `docs/qa-phase9-discovery-leads-reviews.md` |
| Env vars | `docs/VERCEL_ENV_VARS_REQUIRED.md` |
| Supabase SQL ref | `docs/SUPABASE_SQL_TO_RUN.sql` |
| Migrations | `supabase/migrations/067_*.sql` … `072_*.sql` |
| Platform fees logic | `lib/platformFees.ts` |
| Vendor referral cookie | `lib/vendorReferral.ts` |
| Affiliate portal | `app/affiliates/portal/` |
| Vendor referrals portal | `app/vendors/referrals/` |
| Affiliate payout queue | `app/admin/affiliates/payouts/` |
| Vendor referral payout queue | `app/admin/vendor-referrals/payouts/` |
| Stripe webhook | `app/api/webhooks/stripe/route.ts` |

---

## Feedback — How to Report Issues

When you complete the checklist, report back using **item IDs** so we can fix quickly:

| Report | Example |
|--------|--------|
| **Item ID** | e.g. `D2`, `J6`, `K7` |
| **What you did** | e.g. "Clicked Approve on affiliate payout" |
| **What you saw** | e.g. "500 error" or "Button did nothing" |
| **What you expected** | e.g. "Payout status should become Paid" |

**Template:**

```
Item: [e.g. J6]
What I did: 
What I saw: 
What I expected: 
```

That will allow targeted fixes and follow-up changes.
