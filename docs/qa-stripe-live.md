# QA: Stripe LIVE mode

Quick checks to confirm the app uses **live** Stripe keys and Connect only (no sandbox).

## 1. Verify keys are live

- **Secret key:** In production, `STRIPE_SECRET_KEY` must start with `sk_live_`. If you use `sk_test_`, checkout and Connect will fail in prod (guarded by `assertStripeLiveConfig()`).
- **Publishable key:** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` must start with `pk_live_`. Test keys (`pk_test_`) are rejected in production.
- **Where to check:** Vercel → Project → Settings → Environment Variables. Do not log or echo values; confirm **names** and that values in Stripe Dashboard are from **Live** mode.

## 2. Verify webhook is live

- Webhook endpoint: `https://<your-domain>/api/webhooks/stripe`.
- In Stripe Dashboard → Developers → Webhooks, the endpoint must use a **live** signing secret (`whsec_...`). Store it in `STRIPE_WEBHOOK_SECRET`.
- The route rejects events with `livemode === false`; only live events are processed.

## 3. Verify vendor/affiliate Connect onboarding (no sandbox)

- Vendor: go through “Connect account” + “Get onboarding link” from the vendor payouts/portal flow. The redirect URL must be Stripe’s **live** Connect (dashboard.stripe.com), not connect.stripe.com/test or a “sandbox partners” setup URL.
- Affiliate: same for affiliate Connect onboarding.
- Onboarding links are created via `stripe.accountLinks.create()` only; there must be no links in code to `connect.stripe.com/setup` or test OAuth URLs.

## 4. Run local checks

- `npm run verify:env` — ensures required env var **names** are set (does not validate values).
- In production, any Stripe/Connect/checkout route that calls `assertStripeLiveConfig()` will throw a safe error if a required live var is missing or not live-prefixed.

## References

- `docs/STRIPE_LIVE_MODE.md` — full live-mode guarantees.
- `docs/VERCEL_ENV_VARS_REQUIRED.md` — env var list and expected prefixes.
