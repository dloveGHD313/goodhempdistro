# Phase 7+ Validation Checklist

## How to validate the Bugbot fixes

1. **Delivery / state compliance (PR #64)**  
   - Create checkout with `fulfillment_method: "delivery"` and a state that has `allows_delivery_*` true but `allows_sale_*` false for that category → must get 400 `code: "STATE_COMPLIANCE_BLOCK"`, `available_fulfillment: ["pickup","shipping"]`.  
   - Same with `delivery_selected: false` but `fulfillment_method: "delivery"` → delivery path must still run (state required, then both delivery + sale checks).  
   - Non-delivery with `customer_state` where sale disallowed → 400 `code: "STATE_SALE_BLOCK"`.

2. **Driver upload cleanup (PR #64)**  
   - Simulate partial failure: e.g. temporarily break the second doc upload or the first `driver_documents` insert. Submit form with all three docs.  
   - Verify: no orphan files in `driver_documents` bucket for that request; no half-complete `logistics_applications` or `driver_documents` rows; response is 500 with `code: "SUBMIT_FAILED"` and a `ref` (correlation id).

3. **Pay-scale unauthenticated**  
   - Open `/logistics` signed out: pay scale section shows loading → then either table (200) or "Pay scale is not configured yet" (404) or error message (500). No infinite loading.  
   - `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/logistics/pay-scale` (no auth) → 200 or 404 or 500.

4. **Delta-8**  
   - Migration 076: run on DB that has `active = true` and `is_delta8 = true` → migration deactivates those rows then adds constraint; no failure.  
   - Checkout for a delta8 product → 400 `code: "DELTA8_BLOCKED"`.

---

## Bugbot fixes (Phases 1–4)

### Pay scale (unauthenticated) — Bugbot A
- [ ] Start dev server; open `/logistics` **signed out**. Pay scale must render or show "Pay scale not configured" / error (not infinite "Loading…").
- [ ] `curl -s http://localhost:3000/api/logistics/pay-scale` (no auth) returns **200** with `base_pay_driver`, `per_mile_driver`, `minimum_miles`, `minimum_payout_driver`, `formula_note` OR **404** with `code: "PAY_SCALE_NOT_CONFIGURED"`, `message: "Pay scale not configured"`.
- [ ] On 500, API returns `code: "PAY_SCALE_ERROR"`, `message: "Unable to load pay scale"`; UI shows error message. All responses have `Cache-Control: no-store`. Route uses admin client only (no RLS for anon).

### Checkout fulfillment + state sale/delivery — Bugbot B
- [ ] Single source of truth: **fulfillment_method** ∈ pickup | delivery | shipping (not delivery_selected). Setting `fulfillment_method: "delivery"` with `delivery_selected: false` still enforces delivery path.
- [ ] Delivery: `customer_state` required; block if `!isDeliveryAllowedForCategory` OR `!isSaleAllowedForCategory` → 400 `code: "STATE_COMPLIANCE_BLOCK"`, `available_fulfillment: ["pickup","shipping"]`.
- [ ] Non-delivery with `customer_state`: block if `!isSaleAllowedForCategory` → 400 `code: "STATE_SALE_BLOCK"`.

### State rules + migration — Bugbot C & D
- [ ] `isSaleAllowedForCategory(null, *)` returns `true`; `isDeliveryAllowedForCategory(null, *)` returns `false`. No redundant ternary in `lib/server/hempStateRules.ts`.
- [ ] Migration **076** runs even if active delta8 exists: backfill → deactivate active delta8 → add CHECK; delta8 is never active/sellable.

## Branch features

### Signup
- [ ] Sign up with new email; profile is created and user can log in.
- [ ] On trigger/DB error, UI shows friendly message + reference ID; no raw DB error leaked.

### Affiliate Connect
- [ ] In Affiliate Portal, click "Connect with Stripe"; redirect to Stripe onboarding. On failure, UI shows error + reference ID.

### Fulfillment + notifications
- [ ] Checkout with delivery: order has `fulfillment_method: 'delivery'`; vendor receives order notification. Pickup/shipping: `fulfillment_method: 'pickup'` or `'shipping'`.

### Vendor checkout
- [ ] Vendor subscription checkout uses `resolveVendorPriceIdOrThrow`; invalid plan returns 400 "Invalid vendor plan selection".

### Compliance
- [ ] Delta-8 product cannot be purchased; checkout returns 400 `code: "DELTA8_BLOCKED"`. Delivery blocked by state returns 400 with `available_fulfillment: ["pickup","shipping"]`.

### Driver compliance (Phase 6)
- [ ] Driver application requires uploads for driver_license, vehicle_registration, insurance with expiry dates.
- [ ] Submission blocked if required doc or expiry missing; expired docs rejected.
- [ ] Admin can list applications, view docs (signed URLs), approve/reject.

### Content + moderation + tier (Phase 7)
- [ ] `moderation_events` table exists; admin can log/view moderation (removed, flagged).
- [ ] Tier priority: feed ordering uses `author_tier` / `priority_rank` (higher tier = higher weight). See `app/api/posts/route.ts` and migration 081.

### AI gating (Phase 8)
- [ ] **Paid** (subscribed consumer/vendor or admin): full AI in mascot-chat.
- [ ] **Free / unauthenticated**: AskJAX navigation-only (suggestions + links); "general_help" returns upgrade/sign-in message.
- [ ] Guard: `lib/requirePaidAI.ts`; enforced in `app/api/mascot-chat/route.ts`.

## Migrations to run (in order)

- 076, 077, 078, 079, 080, 081
