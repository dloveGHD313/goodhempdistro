# Vercel env vars (names only, where used)

## Required (public)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (Supabase client, admin client)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (client)
- `NEXT_PUBLIC_SITE_URL` — Site URL for redirects, Stripe success/cancel URLs (getSiteUrl, checkout, Connect)

## Required (server-only)
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (admin client, RLS bypass, webhook, platform fees, audit)
- `STRIPE_SECRET_KEY` — Stripe API (checkout, webhook, Connect accounts)
- `STRIPE_WEBHOOK_SECRET` — Webhook signature verification

## Optional (admin / Connect)
- `ADMIN_EMAILS` — Comma-separated admin emails (requireAdmin allowlist)
- `ADMIN_EMAIL_DOMAIN` — Admin domain (requireAdmin)
- `STRIPE_CONNECT_CLIENT_ID` — Optional for OAuth Connect; Express Connect uses STRIPE_SECRET_KEY only
