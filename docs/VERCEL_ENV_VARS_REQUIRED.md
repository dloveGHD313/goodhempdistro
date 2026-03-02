# Vercel Environment Variables (Required for LIVE)

Documentation of **required** environment variable **names** and descriptions only. Do not commit or log secret values.

---

## Required LIVE variables

| Variable | Description |
|----------|-------------|
| **STRIPE_SECRET_KEY** | Stripe API secret key (LIVE). Used for checkout, webhooks, and Connect. |
| **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY** | Stripe publishable key (LIVE). Used by client for Stripe.js / Checkout. |
| **STRIPE_WEBHOOK_SECRET** | Stripe webhook signing secret (LIVE). Used to verify webhook signatures. |
| **STRIPE_CONNECT_CLIENT_ID** | Stripe Connect OAuth client ID (LIVE, starts with `ca_`). Optional for Express account links; required only for OAuth Connect. Documented for completeness. |
| **NEXT_PUBLIC_SITE_URL** | Canonical site URL. Required for absolute Stripe Checkout success/cancel URLs and vendor/affiliate Connect return/refresh URLs. |
| **SUPABASE_SERVICE_ROLE_KEY** | Supabase service role key. Used for admin client, RLS bypass, and server-only operations. |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | Supabase anonymous (public) key. Used by the Supabase client in the browser. |
| **NEXT_PUBLIC_SUPABASE_URL** | Supabase project URL. Used by the Supabase client and server. |
| **STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID** | Vendor Starter monthly price ID (LIVE). Used for vendor subscription checkout. |
| **STRIPE_VENDOR_STARTER_ANNUAL_PRICE_ID** | Vendor Starter annual price ID (LIVE). Used for vendor subscription checkout. |
| **STRIPE_VENDOR_PRO_MONTHLY_PRICE_ID** | Vendor Pro monthly price ID (LIVE). Used for vendor subscription checkout. |
| **STRIPE_VENDOR_PRO_ANNUAL_PRICE_ID** | Vendor Pro annual price ID (LIVE). Used for vendor subscription checkout. |
| **STRIPE_VENDOR_ENTERPRISE_MONTHLY_PRICE_ID** | Vendor Enterprise monthly price ID (LIVE). Used for vendor subscription checkout. |
| **STRIPE_VENDOR_ENTERPRISE_ANNUAL_PRICE_ID** | Vendor Enterprise annual price ID (LIVE). Used for vendor subscription checkout. |

---

## Rules (DO NOT DEVIATE)

- **Stripe TEST keys must NOT be used.** Use only LIVE keys (`sk_live_`, `pk_live_`, `whsec_` from a live webhook).
- **All Stripe IDs referenced in the application are LIVE-mode IDs.** No test-mode product, price, or account IDs.
- **`.env.local` is required for local development.** Copy variable names from this document (or `.env.example`); fill values locally only. Never commit `.env.local` or any file containing secret values.
- **Vercel Environment Variables must match LIVE values exactly.** Set these in Vercel → Project → Settings → Environment Variables for Production (and Preview if needed).

---

## Optional (OAuth-only)

| Variable | Description |
|----------|-------------|
| **STRIPE_CONNECT_CLIENT_ID** | Stripe Connect OAuth client ID (LIVE, starts with `ca_`). Required only for OAuth-based Connect flows. |

---

## Where to set values

- **Vercel:** Project → Settings → Environment Variables. Add each variable by name; paste the value. Do not commit values into the repository.
- **Local:** Create `.env.local` with the same variable names; paste values from Vercel or from Stripe/Supabase dashboards. `.env.local` is gitignored.
