# Environment Variables

This project relies on Supabase and Stripe. Set these in Vercel (Production and Preview) and in your local `.env` file for development.

## Required (Public)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `NEXT_PUBLIC_SITE_URL` — Public site URL (e.g., `https://goodhempdistro.com`)

## Required (Server-only)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-only, never expose to client)
- `STRIPE_SECRET_KEY` — Stripe secret key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret

## Recommended (Admin Access)
- `ADMIN_EMAILS` — Comma-separated list of admin emails
- `ADMIN_EMAIL_DOMAIN` — Optional single domain allowed for admins (e.g., `goodhempdistro.com`)

## Notes
- The app includes runtime guards that surface helpful diagnostics when required variables are missing.
- Avoid committing any secrets. Use `.env` locally and Vercel Environment Variables in production.
