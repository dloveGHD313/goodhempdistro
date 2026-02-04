# Vendor Checkout Guide

End-to-end flow for vendor subscription checkout on Good Hemp Distro.

## Flow (text)

```
1. User → /pricing?tab=vendor
2. Frontend loads vendor plans from /api/pricing/vendor-plans (from env PRICE_IDs)
3. User clicks "Start checkout" on a plan
4. Frontend → POST /api/stripe/checkout
   Body: { productType: "vendor", planKey, tier, cadence }
5. API: auth → getVendorPriceEnvStatus() → resolveVendorPriceId() → vendor row (find or create)
   → Stripe customer (create if needed) → stripe.checkout.sessions.create (subscription, line_items price)
6. API returns { url } → frontend redirects to Stripe Checkout
7. User pays on Stripe → redirect to /checkout/success?session_id=...
8. Stripe sends webhook checkout.session.completed
9. Webhook: signature verify → handleCheckoutSessionCompleted
   → subscriptions upsert, vendors update (subscription_status, etc.), profiles.role = "vendor" when active
10. User sees success page; vendor dashboard/entitlements use subscription data.
```

## Required env vars (no secrets)

- `STRIPE_SECRET_KEY` (sk_live_*)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_live_*)
- `STRIPE_WEBHOOK_SECRET` (whsec_*)
- Vendor PRICE IDs (see [stripe-vendor-pricing.md](./stripe-vendor-pricing.md)):
  - `STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID`
  - `STRIPE_VENDOR_STARTER_ANNUAL_PRICE_ID`
  - `STRIPE_VENDOR_PRO_MONTHLY_PRICE_ID`
  - `STRIPE_VENDOR_PRO_ANNUAL_PRICE_ID`
  - `STRIPE_VENDOR_ENTERPRISE_MONTHLY_PRICE_ID`
  - `STRIPE_VENDOR_ENTERPRISE_ANNUAL_PRICE_ID`

## Stripe setup checklist

1. **Products**: Create 3 vendor products in Stripe Dashboard (e.g. Starter, Pro, Enterprise).
2. **Prices**: Create 6 prices (monthly + annual per product); note each `price_...` ID.
3. **Env**: Set the 6 `STRIPE_VENDOR_*_*_PRICE_ID` vars in Vercel to those price IDs.
4. **Webhook**: In Stripe Dashboard → Webhooks, add endpoint for your production URL: `https://<domain>/api/webhooks/stripe`. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid` / `invoice.payment_succeeded` / `invoice.payment_failed`
   - `payment_intent.succeeded` / `payment_intent.payment_failed`
5. Set `STRIPE_WEBHOOK_SECRET` to the signing secret from the webhook.

## Webhook events (vendor-relevant)

| Event | Use |
|-------|-----|
| `checkout.session.completed` | Create/update subscription record; update vendors row; set profiles.role = "vendor" when subscription active |
| `customer.subscription.created/updated/deleted` | Keep vendors.subscription_* and subscriptions table in sync |
| `invoice.paid` / `invoice.payment_succeeded` | Referral/affiliate tracking |

## Common errors and debugging

All API error responses include `requestId` (and header `X-Request-Id`). Use it to find the same request in logs.

| errorReason | Meaning | What to do |
|-------------|---------|------------|
| `unauthorized` | Not logged in | User must sign in |
| `invalid_request` | Missing productType/planKey/cadence | Frontend should always send these |
| `vendor_billing_not_configured` | Missing or invalid PRICE_ID env | Set all 6 vendor PRICE_ID vars; values must start with `price_` |
| `invalid_vendor_plan` | planKey/cadence not in env plans | Check planKey matches lib/pricing (e.g. vendor_starter_monthly) |
| `vendor_provision_failed` | Could not create/find vendor row | Check Supabase vendors table and RLS; see logs for insert error |
| `stripe_customer_create_failed` | Stripe API error creating customer | Check logs for stripeErrorCode/type; fix Stripe config |
| `stripe_session_create_failed` | Stripe API error creating checkout session | Check logs for stripeErrorCode/type; often invalid price or account |
| `Stripe rejected request` | Generic Stripe error in catch | Logs include stripeRequestId and message |

**Log search**: In Vercel (or your log provider), search for `requestId <uuid>` or `[stripe/checkout]` and the requestId to see step-by-step logs (start, parsed, vendor_price_resolved, stripe_create_session_call, etc.).

## Testing

1. **Plans load**: Navigate to `/pricing?tab=vendor`. Confirm vendor plans and prices render (no “missing env” state if vars are set).
2. **Happy path**: Click “Start checkout” on a plan. You should be redirected to Stripe Checkout. Complete payment (use live card in production; do not weaken liveGuard without CEO approval). Return to success page; confirm webhook runs and vendor subscription + profile role are updated in Supabase.
3. **Error paths**: To validate error UX and requestId:
   - Temporarily break one PRICE_ID in env (e.g. set to empty or invalid). Trigger checkout → expect 500 with `vendor_billing_not_configured`, `missingEnv`/`invalidEnv`, and `requestId`. Search logs for that requestId.
   - Restore env before committing.

See [stripe-vendor-pricing.md](./stripe-vendor-pricing.md) for validation script (`node scripts/validate-stripe-env.mjs`).
