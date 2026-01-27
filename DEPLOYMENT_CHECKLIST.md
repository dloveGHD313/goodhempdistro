# 🚀 Production Deployment Checklist

This checklist ensures the Good Hemp Distro platform is properly configured for production deployment on Vercel.

## Pre-Deployment (Local)

- [ ] **Review code changes**: Run `git diff main` to ensure all changes are intentional
- [ ] **Run tests**: Execute `npm run lint && npm run test` - all tests must pass
- [ ] **Build locally**: Execute `npm run build` - no errors or warnings
- [ ] **Database**: Run Supabase migrations in production
- [ ] **Secrets audit**: Verify `.env.example` contains no real credentials (only placeholders)

## Vercel Environment Setup

Set these environment variables in your Vercel project settings at https://vercel.com/dashboard

### Public Variables (NEXT_PUBLIC_*)

These are safe to expose to the browser. Set them for each environment:

| Variable | Development | Staging | Production | Source |
|----------|-------------|---------|-----------|--------|
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | `https://staging.yourdomain.com` | `https://goodhempdistro.vercel.app` or custom domain | Your Vercel URL or DNS |
| `NEXT_PUBLIC_SUPABASE_URL` | Same across all | Same across all | Same across all | Supabase Project Settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same across all | Same across all | Same across all | Supabase Project Settings → API |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_*` | `pk_test_*` | `pk_live_*` | Stripe Dashboard → API Keys |

### Private Variables (Server-Only)

Set in Vercel **Environment Variables** section. These are never exposed to the client:

| Variable | Required | Development | Production | Source | Security Notes |
|----------|----------|-------------|-----------|--------|-----------------|
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | test key | production key | Supabase → Settings → API | **CRITICAL**: Only used in `/api/` routes. Rotate quarterly. |
| `STRIPE_SECRET_KEY` | ✅ | `sk_test_*` | `sk_live_*` | Stripe Dashboard → API Keys | Used for payment processing. Rotate monthly. |
| `STRIPE_WEBHOOK_SECRET` | ✅ | `whsec_test_*` | `whsec_live_*` | Stripe Webhooks Dashboard | Webhook signing. Rotate after endpoint change. |
| `ADMIN_EMAILS` | ✅ | `admin@example.com` | `hellogoodhempdistros@gmail.com` | Vercel project settings | Comma-separated admin allowlist. |

### Consumer Plan Price IDs (Production)

These are required for `/pricing?tab=consumer` and `/get-started` to show all six plans:

- `STRIPE_CONSUMER_STARTER_MONTHLY_PRICE_ID`
- `STRIPE_CONSUMER_STARTER_ANNUAL_PRICE_ID`
- `STRIPE_CONSUMER_PLUS_MONTHLY_PRICE_ID`
- `STRIPE_CONSUMER_PLUS_ANNUAL_PRICE_ID`
- `STRIPE_CONSUMER_VIP_MONTHLY_PRICE_ID`
- `STRIPE_CONSUMER_VIP_ANNUAL_PRICE_ID`

### Steps to Configure in Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add each variable above
3. Select which deployments get which values (Development/Preview/Production)
4. For production: use `pk_live_*` and `sk_live_*` keys from Stripe
5. Click "Save" for each variable
6. Redeploy with `git push` or trigger manually

## Stripe Webhook Configuration

### Critical: Configure Webhook Endpoint

1. Log in to https://dashboard.stripe.com/webhooks
2. Click **"Add endpoint"**
3. Endpoint URL: `https://goodhempdistro.vercel.app/api/webhooks/stripe`
   - Replace with your actual production domain
4. Events to listen: Select **All events** or specifically:
   - ✅ `checkout.session.completed`
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
5. Copy the **Signing Secret** (`whsec_*`)
6. Set as `STRIPE_WEBHOOK_SECRET` in Vercel
7. Test webhook with Stripe CLI:
   ```bash
   stripe listen --forward-to yourdomain.com/api/webhooks/stripe
   stripe trigger checkout.session.completed
   ```

### Webhook Testing Checklist

- [ ] Webhook endpoint responds with `200 OK`
- [ ] Webhook logs appear in `/api/webhooks/stripe` console
- [ ] Order status updates correctly in Supabase after payment
- [ ] No "webhook signature verification failed" errors in logs

## Supabase Database

### Initial Setup

1. Create tables via SQL editor or migrations:
   - `orders` - order tracking
   - `products` - product catalog
   - `subscriptions` - customer subscriptions
   - `vendor_applications` - vendor onboarding

2. Enable Row Level Security (RLS):
   - All tables should have RLS enabled
   - Service role bypasses RLS (used in `/api/`)
   - Anon key has restricted read access only

### Pre-Production Verification

- [ ] All migrations applied
- [ ] RLS policies configured correctly
- [ ] Service role key has admin access
- [ ] Anon key has read-only access where needed
- [ ] Tables have proper indexes on frequently queried columns

## Security Hardening

### Secret Rotation Schedule

- [ ] **Monthly**: Rotate `STRIPE_SECRET_KEY` if changed
- [ ] **Monthly**: Rotate `STRIPE_WEBHOOK_SECRET` after changes
- [ ] **Quarterly**: Rotate `SUPABASE_SERVICE_ROLE_KEY` for audit compliance
- [ ] **Immediately**: If any secret is compromised, rotate all keys

### Secret Rotation Steps

1. Generate new secret in provider dashboard (Stripe, Supabase)
2. Create new Vercel environment variable with new value
3. Redeploy application
4. Monitor logs for failures
5. Once confirmed working, revoke old secret in provider dashboard

### Code Security Review

- [ ] No secrets in `.env.example` (only placeholders)
- [ ] No `console.log()` of sensitive data (tokens, keys, user emails)
- [ ] Server routes use `createSupabaseServerClient()` not browser client
- [ ] Stripe webhook signature verification enabled
- [ ] CORS/CSRF protection in place
- [ ] Admin routes require authentication
- [ ] Rate limiting on payment endpoints

## Monitoring & Logging

### Vercel Logs

Monitor logs at: https://vercel.com/dashboard/YOUR_PROJECT/monitoring/logs

Key metrics to watch:
- Error rate in `/api/webhooks/stripe`
- Payment success/failure rates
- Order confirmation latency
- Database query performance

### Stripe Dashboard

Monitor at: https://dashboard.stripe.com

Key checks:
- Payment success rate (target: >98%)
- Webhook delivery status (failures indicate issues)
- Dispute/chargeback rate (should be <0.1%)

### Supabase Dashboard

Monitor at: https://app.supabase.com

Key checks:
- Database connection count
- Query performance
- RLS policy enforcement
- Real-time subscriptions

## Post-Deployment

- [ ] Verify `/` homepage loads in production
- [ ] Test checkout flow end-to-end (test card: `4242 4242 4242 4242`)
- [ ] Check order appears in Supabase `orders` table with correct status
- [ ] Verify webhook webhook delivers successfully in Stripe dashboard
- [ ] Check `/orders/success` page loads after payment
- [ ] Verify `/pricing?tab=consumer` shows 6 consumer plans with images
- [ ] Verify `/get-started` shows 6 consumer plans with images
- [ ] Verify `/account/subscription` shows plan image, loyalty points, and referral code
- [ ] Monitor error logs for 24 hours
- [ ] Test logout functionality
- [ ] Verify emails/notifications sent (if applicable)

## Phase 4 — Consumer Loyalty & Referrals Verification

- [ ] Confirm subscription bonus points are awarded exactly once per subscription
- [ ] Confirm points-per-dollar is applied to purchases
- [ ] Confirm referral rewards are granted only after first paid subscription
- [ ] Confirm `/api/webhooks/stripe` logs show no duplicate loyalty events
- [ ] Confirm `/api/admin/diag/env` lists missing consumer price IDs (admin-only)

### Loyalty + Referral Rules (Hard-Locked)

- Subscription bonus points: **500**
- Base points per dollar: **1**
- Loyalty multipliers: Starter 1.0x, Plus 1.5x, VIP 2.0x
- Referral rewards: Starter 250, Plus 500, VIP 1000

## Phase 4 Complete — Sign-off

- [ ] Production deployment is on latest main commit
- [ ] Consumer plan images + bullets render on `/pricing` and `/get-started`
- [ ] Admin diagnostics confirm no missing consumer Stripe price IDs
- [ ] Loyalty + referral events verified in Supabase

## Rollback Plan

If issues occur in production:

1. **Immediate**: Monitor Vercel logs and Stripe webhooks for errors
2. **Diagnosis**: Check:
   - Webhook signature verification failures → webhook secret mismatch
   - Database update failures → RLS policy or connection issue
   - Stripe API errors → API key or rate limit issue
3. **Rollback**:
   ```bash
   git revert <commit-hash>
   git push  # Vercel auto-redeploys
   ```
4. **Notify**: Alert team members to monitor logs

## Quick Reference: File Locations

| Component | File | Responsibility |
|-----------|------|-----------------|
| Environment validation | `lib/supabase.ts` | Validates `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Webhook handling | `app/api/webhooks/stripe/route.ts` | Signature verification, event processing |
| Order confirmation | `app/api/orders/confirm/route.ts` | Validates session, updates order status |
| Logout | `app/api/auth/logout/route.ts` | Clears Supabase session |
| Site URL config | `lib/stripe.ts` | `getSiteUrl()` returns `NEXT_PUBLIC_SITE_URL` |

## Support & Troubleshooting

### "Module not found: Can't resolve '@/lib/supabase'"
- Solution: Check `tsconfig.json` has `"@/*": ["./*"]` path alias
- Verify: Run `npm run build` locally

### "Webhook signature verification failed"
- Check: `STRIPE_WEBHOOK_SECRET` matches dashboard value
- Check: Endpoint URL in Stripe matches production domain
- Test: Use Stripe CLI to test locally first

### "Missing SUPABASE_SERVICE_ROLE_KEY"
- Set in Vercel → Settings → Environment Variables
- Ensure it's set for "Production" deployments

### "Order status not updating after payment"
- Check: Webhook logs in Vercel → Logs
- Check: Supabase RLS policies allow service role write
- Check: Order ID is in Stripe session metadata

### "Consumer plans missing in production"
- Confirm all six `STRIPE_CONSUMER_*_PRICE_ID` variables are set for Production
- Check Vercel logs for `[pricing/consumer-plans] Missing env vars`
- Confirm `NEXT_PUBLIC_SITE_URL` and `STRIPE_SECRET_KEY` are set in Production

---

**Last Updated**: January 15, 2026  
**Status**: ✅ Production Ready
