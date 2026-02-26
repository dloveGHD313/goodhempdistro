# Stripe Checkout — Live Price Allowlist Verification

**Date:** Final verification  
**Rule:** All Stripe Checkout Session creation must use price IDs from `lib/stripe/prices.ts` (STRIPE_PRICES) only — either via server-side mapping or allowlist validation. No unvalidated client `priceId`, no hardcoded `price_*`, no env-var-driven checkout pricing.

---

## Files containing `stripe.checkout.sessions.create`

| File | Status | Notes |
|------|--------|--------|
| `app/api/stripe/checkout/route.ts` | **SAFE** | `priceId` from `resolvePriceId()` (allowlist from STRIPE_PRICES). Accepts `priceId` or `planKey`+`billingInterval`; both validated. |
| `app/api/subscriptions/checkout/route.ts` | **SAFE** | `priceId` from `STRIPE_PRICES[pk][bi]` via `CONSUMER_PLANKEY_TO_STRIPE[planKey]`. No client priceId. |
| `app/api/stripe/vendor/create-checkout-session/route.ts` | **SAFE** | `priceId` from `STRIPE_PRICES[planKey].MONTHLY` via `resolveVendorPriceId(planName)`. No client priceId. |
| `lib/stripe.ts` (createSubscriptionSession) | **SAFE** | `priceId` from `resolvePriceId({ priceId: rawPriceId })` before session create. |
| `lib/stripe.ts` (createCheckoutSession) | **SAFE** | Uses `price_data` + `unit_amount` (one-time payment). No Stripe Price ID. |
| `app/api/checkout/create-session/route.ts` | **SAFE** | `mode: "payment"`, `price_data` + `unit_amount`. Product checkout. |
| `app/api/vendor/checkout/route.ts` | **DELETED** | Deprecated 410 route removed in debug sweep 2025-02-25. Was replaced by `/api/stripe/checkout`. |
| `app/api/events/checkout/route.ts` | **SAFE** | `mode: "payment"`, `price_data` + `unit_amount`. Event tickets. |

---

## Confirmation

- **No unvalidated priceId can reach Stripe.** All subscription checkout paths resolve or validate `priceId` via STRIPE_PRICES (allowlist in `lib/stripe.ts` `resolvePriceId`, or direct mapping in subscriptions/checkout and stripe/vendor/create-checkout-session).
- **No hardcoded price_ IDs remain in checkout session creation.** Only `lib/stripe/prices.ts` contains Stripe Price ID literals; all session creation uses that module or the derived allowlist.
- **No env-var-driven price selection for checkout line_items.** Consumer and vendor plan configs use STRIPE_PRICES; env vars are not used for checkout price selection.
