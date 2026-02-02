# Stripe LIVE MODE — Good Hemp Distro

The platform runs **100% in Stripe LIVE MODE**. No sandbox, no test keys, no NODE_ENV-based Stripe branching.

---

## Keys and secrets

| Variable | Requirement | Enforcement |
|----------|-------------|-------------|
| `STRIPE_SECRET_KEY` | **Must be a live secret key** (`sk_live_...`) | `lib/stripe/liveGuard.ts`: `assertStripeLiveSecret()` runs before any Stripe client use. Throws if missing, empty, or `sk_test_`. |
| `STRIPE_WEBHOOK_SECRET` | **Must be a live webhook signing secret** (`whsec_...`) | `assertStripeWebhookSecret()` in webhook handler. Throws if missing, empty, or not `whsec_`. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Use live publishable key (`pk_live_...`) for frontend Stripe.js | Set in Vercel; no server-side guard. |

**Guarantees:**

- Stripe is **always** initialized from `STRIPE_SECRET_KEY` (single client in `lib/stripe.ts`).
- If `STRIPE_SECRET_KEY` is set and does **not** start with `sk_live_`, the app throws at **first Stripe use** (checkout, Connect, webhook). No test keys are accepted at runtime.
- Webhook handler rejects requests when `STRIPE_WEBHOOK_SECRET` is missing or does not start with `whsec_`.
- **Build:** To fail the build when a test key is present, set `STRIPE_SECRET_KEY=sk_live_...` (or leave unset) in your build environment; runtime guard ensures no test key is ever used for Stripe API calls.

---

## Webhooks

- **Signature:** Verified with `stripe.webhooks.constructEvent(body, signature, webhookSecret)`. Signature mismatch returns 400 and is logged.
- **Live mode only:** After verification, the handler checks `event.livemode === true`. If `livemode` is `false` (test-mode event), the handler returns 400 and does not process the event.
- **Idempotency:** Handlers should rely on existing DB constraints and idempotent updates where applicable (e.g. upserts keyed by Stripe IDs).

**File:** `app/api/webhooks/stripe/route.ts`

---

## Stripe Connect (vendors + affiliates)

- Uses the **same live Stripe client** (`lib/stripe.ts`). No separate test client.
- Connect account creation and onboarding links are created with the live API; no `connect.stripe.com/test` URLs or test OAuth client IDs in code.
- Redirect URLs come from `getSiteUrl(req)` (production URL from env or headers).

---

## Order and revenue flow (live only)

- **Checkout:** All checkout session creation uses the live Stripe client and allowlisted price IDs (`lib/stripe/prices.ts`).
- **Webhook:** `checkout.session.completed`, `payment_intent.succeeded`, `invoice.paid`, `customer.subscription.*` are processed only when `event.livemode === true`.
- **Orders:** Orders are marked paid and fees/loyalty/affiliate/vendor-referral flows run only from live webhook events.
- **Admin analytics:** Overview and related endpoints query orders with `status = 'paid'` only; no test/livemode filter in DB (Stripe livemode is enforced at webhook ingestion).

---

## Startup / runtime checks

- **Stripe secret:** Enforced when the Stripe client is first used (`getStripeClient()` in `lib/stripe.ts`).
- **Webhook secret:** Enforced when the webhook route handles a request (`getWebhookSecret()` in `app/api/webhooks/stripe/route.ts`).
- **Supabase:** `SUPABASE_SERVICE_ROLE_KEY` is validated by existing env validation where used; no change to Stripe live enforcement.

---

## What is not allowed

- **Test keys:** `sk_test_`, `pk_test_` must not be used for payments, Connect, or webhooks.
- **Test webhook secret:** Webhook secret must be the live endpoint’s signing secret (`whsec_...`).
- **Test-mode events:** Events with `livemode === false` are rejected and not processed.
- **Sandbox / test routing:** No conditional logic that switches Stripe behavior by NODE_ENV or environment for payments, Connect, or webhooks.

---

## QA / verification

- **LIVE VERIFIED:** Stripe usage is guarded by `lib/stripe/liveGuard.ts` and webhook `livemode` check. All payments, Connect, webhooks, platform fees, loyalty, affiliate payouts, and vendor referral payouts run in live mode when the app is configured with live keys and live webhook secret.
