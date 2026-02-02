# Vercel Environment Variables (Required)

**Do not commit real values.** Use Vercel → Project → Settings → Environment Variables. For local dev, copy variable **names** into `.env.local` and fill from Vercel or dashboards.

## Required (public)

| Variable | Purpose | Expected prefix / format |
|----------|---------|---------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://<project>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | `eyJ...` |
| `NEXT_PUBLIC_SITE_URL` | Site URL for redirects, Stripe success/cancel, Connect | e.g. `https://goodhempdistro.com` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (LIVE) | `pk_live_...` |

## Required (server-only)

| Variable | Purpose | Expected prefix / format |
|----------|---------|---------------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (admin client, RLS bypass, webhooks) | `eyJ...` |
| `STRIPE_SECRET_KEY` | Stripe API (checkout, webhook, Connect) | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | `whsec_...` |
| `STRIPE_CONNECT_CLIENT_ID` | Connect (vendor/affiliate onboarding) | `ca_...` (live) |

## Optional

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Server-side Supabase URL (fallback if not using `NEXT_PUBLIC_SUPABASE_URL`) |
| `ADMIN_EMAILS` | Comma-separated admin emails (requireAdmin allowlist) |
| `ADMIN_EMAIL_DOMAIN` | Admin domain (requireAdmin) |
| `DEBUG_KEY` | Debug gate for vendor registration / diag |
| `INTOXICATING_ALLOWED_UNTIL` | Compliance cutoff (e.g. `2026-11-01`) |
| `OPENAI_API_KEY` | Mascot chat (if Mascot enabled) |
| `OPENAI_MODEL` | e.g. `gpt-4o-mini` |
| `OPENAI_SEARCH_MODEL` | e.g. `gpt-4o-mini-search-preview` |
| `MASCOT_AI_ENABLED` | Server flag for Mascot |
| `NEXT_PUBLIC_MASCOT_ENABLED` | Client flag for Mascot |

## Stripe price/product IDs (optional overrides)

If the app uses env-based price/product IDs (see `lib/pricing.ts`, `lib/consumer-plans.ts`), set:

- `STRIPE_CONSUMER_STARTER_MONTHLY_PRICE_ID`, `STRIPE_CONSUMER_STARTER_ANNUAL_PRICE_ID`
- `STRIPE_CONSUMER_PLUS_MONTHLY_PRICE_ID`, `STRIPE_CONSUMER_PLUS_ANNUAL_PRICE_ID`
- `STRIPE_CONSUMER_VIP_MONTHLY_PRICE_ID`, `STRIPE_CONSUMER_VIP_ANNUAL_PRICE_ID`
- `STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID`, `STRIPE_VENDOR_STARTER_ANNUAL_PRICE_ID`
- `STRIPE_VENDOR_PRO_MONTHLY_PRICE_ID`, `STRIPE_VENDOR_PRO_ANNUAL_PRICE_ID`
- `STRIPE_VENDOR_ENTERPRISE_MONTHLY_PRICE_ID`, `STRIPE_VENDOR_ENTERPRISE_ANNUAL_PRICE_ID`
- `STRIPE_VENDOR_*_PRODUCT_ID` (same tiers)

## Filling local `.env.local`

1. Copy `.env.example` to `.env.local`.
2. In Vercel: Project → Settings → Environment Variables → copy **names** (not values).
3. Paste real values only in local `.env.local`; never commit `.env.local`.
