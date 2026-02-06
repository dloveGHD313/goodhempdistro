# Phase 7+ Validation Checklist

## Bugbot fixes (Phases 1–4)

### Pay scale (unauthenticated) — Bugbot A
- [ ] Start dev server; open `/logistics` **signed out**. Pay scale must render or show "Pay scale not configured" / error (not infinite "Loading…").
- [ ] `curl -s http://localhost:3000/api/logistics/pay-scale` (no auth) returns **200** with `base_pay_driver`, `per_mile_driver`, `minimum_miles`, `minimum_payout_driver`, `formula_note` OR **404** with `code: "PAY_SCALE_NOT_CONFIGURED"`, `message: "Pay scale not configured"`.
- [ ] On 500, API returns `code: "PAY_SCALE_ERROR"`, `message: "Unable to load pay scale"`; UI shows error message. All responses have `Cache-Control: no-store`. Route uses admin client only (no RLS for anon).

### Checkout fulfillment bypass — Bugbot B
- [ ] Delivery compliance and fees are driven by **fulfillment_method** (not delivery_selected). Setting `fulfillment_method: "delivery"` with `delivery_selected: false` still enforces state rules and delivery fees.
- [ ] Missing state for delivery returns `code: "STATE_REQUIRED"`; disallowed state returns `code: "DELIVERY_NOT_ALLOWED"` with `available_fulfillment: ["pickup","shipping"]`.

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
- [ ] Delta-8 product cannot be purchased. Delivery blocked by state returns 400 with `available_fulfillment: ["pickup","shipping"]`.

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
