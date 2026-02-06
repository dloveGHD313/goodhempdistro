# Phase 7+ Validation Checklist

## Completed in this branch (feat/phase-7-compliance-content)

### Phase 1 — Pay scale (public)
- [ ] Start dev server; open `/logistics` **signed out**. Pay scale must render or show "Pay scale not configured" / error (not infinite "Loading…").
- [ ] `curl -s http://localhost:3000/api/logistics/pay-scale` (no auth) returns **200** with `base_pay_driver`, `per_mile_driver`, `minimum_miles`, `minimum_payout_driver`, `formula_note` OR **404** with `code: "PAY_SCALE_NOT_CONFIGURED"`.
- [ ] On 500, API returns `code: "PAY_SCALE_ERROR"`; UI shows error message.

### Phase 2 — State rules default + migration
- [ ] `isSaleAllowedForCategory(null, *)` returns `true`; `isDeliveryAllowedForCategory(null, *)` returns `false`.
- [ ] Run migration `076`: if any product is `active = true` and `is_delta8 = true`, they are set `active = false` before constraint is added; migration does not fail.

### Phase 3 — Signup (already in branch)
- [ ] Sign up with new email; profile is created and user can log in.
- [ ] On trigger/DB error, UI shows friendly message + reference ID; no raw DB error leaked.

### Phase 4 — Affiliate Connect
- [ ] In Affiliate Portal, click "Connect with Stripe"; redirect to Stripe onboarding.
- [ ] Return to site; connection status shows and updates (charges_enabled / payouts_enabled when applicable).
- [ ] On failure, UI shows error + reference ID.

### Phase 5 — Fulfillment + notifications
- [ ] Create product checkout with `delivery_selected: true` (and valid state/distance); order has `fulfillment_method: 'delivery'` and vendor receives "New Delivery Order" in `order_notifications`.
- [ ] Checkout with `fulfillment_method: 'pickup'` or no delivery; order has `fulfillment_method: 'pickup'` and vendor receives "New Pickup Order".
- [ ] Vendor can read own `order_notifications` (e.g. from vendor dashboard when implemented).

### Phase 9 — Vendor checkout
- [ ] Vendor subscription checkout uses `resolveVendorPriceIdOrThrow`; invalid planKey or missing env returns 400 "Invalid vendor plan selection".

### Compliance (already in branch)
- [ ] Delta-8 product cannot be purchased (checkout returns 400).
- [ ] Delivery with `customer_state` in a state with no rule or disallowed delivery returns 400 with `available_fulfillment: ["pickup","shipping"]`.
- [ ] Pickup/shipping still allowed when delivery is blocked.

## Not yet implemented (future PRs)

- **Phase 6:** Driver compliance uploads (driver_applications, driver_documents, bucket, required docs at apply time, admin review).
- **Phase 7:** Social/content (content_posts, moderation_events, go_live scaffold, tier priority).
- **Phase 8:** AI gating (requirePaidAI, AskJAX navigation-only for free).

## Migrations to run (in order)

- 076, 077, 078, 079
