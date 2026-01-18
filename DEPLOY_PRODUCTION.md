# Production Deployment Guide - Good Hemp Distro

This guide walks you through deploying the Good Hemp Distro marketplace to Vercel with Supabase and Stripe integration.

## Prerequisites

- [ ] Vercel account with project connected to your Git repository
- [ ] Supabase project (production instance)
- [ ] Stripe account with live API keys

---

## Environment Variables Required

### Public Variables (NEXT_PUBLIC_*)
These are exposed to the browser and must start with `NEXT_PUBLIC_`.

| Variable | Source | Example |
|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → Project API keys → `anon` `public` | `eyJhbGc...` |
| `NEXT_PUBLIC_SITE_URL` | Your Vercel production domain | `https://your-app.vercel.app` |

### Server-Only Variables (Secret)
These are only available server-side and MUST NOT be exposed to the browser.

| Variable | Source | Example |
|----------|--------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → Project API keys → `service_role` (⚠️ Keep secret!) | `eyJhbGc...` |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → Secret key (⚠️ Use **live** key for production) | `sk_live_...` or `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Created in step 3 below | `whsec_...` |

---

## Step-by-Step Deployment

### 1. Configure Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable from the tables above:
   - Click **Add New**
   - Enter the **Key** (exact name from table)
   - Paste the **Value** from the corresponding source
   - Select environment: **Production** (and optionally Preview/Development)
   - Click **Save**

**Critical:** Double-check that `NEXT_PUBLIC_SITE_URL` is set to your actual Vercel domain (e.g., `https://goodhempdistro.vercel.app`).

### 2. Supabase Configuration

1. Log in to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your **production** project
3. Go to **Settings** → **API**
4. Copy the following values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Important:** The `service_role` key bypasses Row Level Security. Keep it secret and only use server-side.

#### 2a. Run Database Migrations

**Before the app can work, you must run all database migrations in order:**

**Migration files (run in order):**
1. `supabase/migrations/001_marketplace_core.sql` - Core marketplace schema (profiles, vendors, products, orders, order_items)
2. `supabase/migrations/002_categories.sql` - Categories table for product categorization
3. `supabase/migrations/003_categories_group.sql` - Add group column to categories table

**Steps for each migration:**

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **New Query**
3. Open the migration file from this repository (start with `001_marketplace_core.sql`)
4. Copy the entire contents of the file
5. Paste into the SQL Editor
6. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)
7. **Repeat steps 2-6 for each migration file in order** (001, then 002, then 003)

**Expected output:** You should see "Success. No rows returned" (this is normal - migrations don't return data).

**Verify migration success:**

After running all migrations, verify tables and columns were created:

```sql
-- Check if tables exist
SELECT to_regclass('public.vendors') AS vendors_exists;
SELECT to_regclass('public.products') AS products_exists;
SELECT to_regclass('public.orders') AS orders_exists;
SELECT to_regclass('public.order_items') AS order_items_exists;
SELECT to_regclass('public.categories') AS categories_exists;

-- Check if function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'update_updated_at_column';

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('vendors', 'products', 'orders', 'order_items', 'categories');

-- Verify categories table structure (should show: id, name, group, created_at, updated_at)
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'categories'
ORDER BY ordinal_position;
```

**All should return non-null values for tables and show `rowsecurity = true` for RLS. Categories table should have columns: `id`, `name`, `group`, `created_at`, `updated_at`.**

**Admin Category Management:**

- Admin category management is available at `/admin/categories`
- **Access requires:** User must have `profile.role = 'admin'` in the `profiles` table
- To grant admin access: Update the user's profile in Supabase: `UPDATE profiles SET role = 'admin' WHERE id = '<user_id>';`
- Admin can create, edit, and delete categories with groups: `industrial`, `recreational`, `convenience`, `food`

**If migration fails:**
- Check error messages in SQL Editor
- Ensure you have sufficient permissions in Supabase
- All migrations are idempotent - you can run them multiple times safely
- Make sure to run migrations in order (001, 002, 003)

### 3. Stripe Webhook Configuration

Stripe webhooks notify your app when payments succeed, fail, or subscriptions change.

#### 3a. Create Production Webhook Endpoint

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Switch to **Live mode** (toggle in top-right)
3. Navigate to **Developers** → **Webhooks**
4. Click **Add endpoint**
5. Enter your webhook URL:
   ```
   https://YOUR-VERCEL-DOMAIN.vercel.app/api/webhooks/stripe
   ```
   Replace `YOUR-VERCEL-DOMAIN` with your actual domain (e.g., `goodhempdistro.vercel.app`)

6. Click **Select events** and choose:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

7. Click **Add endpoint**

#### 3b. Copy Webhook Signing Secret

1. After creating the endpoint, click on it to view details
2. In the **Signing secret** section, click **Reveal**
3. Copy the secret (starts with `whsec_...`)
4. Go back to Vercel → Settings → Environment Variables
5. Add `STRIPE_WEBHOOK_SECRET` with the copied value
6. Select **Production** environment and **Save**

### 4. Get Stripe API Keys

1. In Stripe Dashboard, go to **Developers** → **API keys**
2. Switch to **Live mode** (top-right toggle)
3. Copy the **Secret key** (starts with `sk_live_...`)
4. Add it to Vercel as `STRIPE_SECRET_KEY`

⚠️ **Never commit or expose** `sk_live_...` keys. These allow charging real cards.

### 5. Deploy to Production

After setting all environment variables:

1. **Trigger a deployment:**
   - Option A: Push a new commit to your main branch
   - Option B: In Vercel Dashboard → Deployments → click **Redeploy**

2. **Monitor the deployment:**
   - Watch the build logs for any errors
   - Verify all environment variables are loaded

3. **Check runtime logs:**
   - Go to Vercel Dashboard → Logs (Runtime Logs)
   - Ensure no `Missing environment variable` errors appear

### 6. Verify Production Setup

#### 6a. Test Checkout Flow

1. Visit your production site: `https://your-app.vercel.app`
2. Add a product to cart and proceed to checkout
3. Use a [Stripe test card in live mode](https://stripe.com/docs/testing) (or a real card if ready):
   - Test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any CVC
4. Complete the payment

#### 6b. Verify Webhook Processing

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click on your production webhook endpoint
3. Check **Events** tab - you should see:
   - `checkout.session.completed` with 200 response
   - `payment_intent.succeeded` with 200 response

If you see errors (4xx/5xx), check your Vercel Runtime Logs.

#### 6c. Confirm Order Status Update

1. Go to Supabase Dashboard → Table Editor → `orders` table
2. Find your test order
3. Verify `status` changed from `pending` to `paid`
4. Check `stripe_payment_intent_id` is populated

✅ **Success:** If all checks pass, your production integration is working!

---

## Troubleshooting

### Webhook Returns 500 Error

**Symptom:** Stripe webhook events show 500 responses.

**Solutions:**
1. Check Vercel Runtime Logs for the exact error
2. Verify `STRIPE_WEBHOOK_SECRET` matches the signing secret in Stripe
3. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set correctly
4. Confirm your Supabase `orders` table exists and has correct schema

### Orders Stuck in "pending" Status

**Causes:**
1. Webhook endpoint not configured or returning errors
2. Wrong `STRIPE_WEBHOOK_SECRET` (signature verification fails)
3. Database permissions issue (check Supabase RLS policies)

**Debug:**
- Check Stripe webhook event logs
- Check Vercel runtime logs for webhook processing
- Manually test webhook locally with Stripe CLI:
  ```bash
  stripe listen --forward-to localhost:3000/api/webhooks/stripe
  ```

### Environment Variables Not Loading

**Symptom:** Logs show "Missing NEXT_PUBLIC_SUPABASE_URL" or similar.

**Solutions:**
1. Redeploy after adding new environment variables
2. Ensure variables are set for **Production** environment in Vercel
3. Check variable names match exactly (case-sensitive)
4. For `NEXT_PUBLIC_*` vars, verify they're set before build time

### NEXT_PUBLIC_SITE_URL Incorrect

**Symptom:** Stripe redirects fail or point to wrong domain.

**Solution:**
1. Update `NEXT_PUBLIC_SITE_URL` in Vercel to your actual domain
2. Remove trailing slashes: ✅ `https://app.vercel.app` ❌ `https://app.vercel.app/`
3. Redeploy

---

## Security Checklist

- [ ] `service_role` key is never exposed to browser (server-only)
- [ ] `STRIPE_SECRET_KEY` is never logged or exposed
- [ ] `STRIPE_WEBHOOK_SECRET` is never exposed
- [ ] Webhook signature verification is enabled (already implemented)
- [ ] Using live Stripe keys in production (not test keys)
- [ ] Supabase Row Level Security (RLS) policies are enabled on production tables
- [ ] All public environment variables (`NEXT_PUBLIC_*`) contain no secrets

---

## Monitoring & Maintenance

### Regular Checks

1. **Stripe Dashboard → Webhooks**
   - Monitor success rates (should be >99%)
   - Check for failed events

2. **Vercel Runtime Logs**
   - Watch for unexpected errors
   - Monitor API route performance

3. **Supabase Logs**
   - Check for database errors
   - Monitor query performance

### Webhook Event Replay

If a webhook fails, you can replay it:
1. Go to Stripe Dashboard → Developers → Webhooks
2. Click on your endpoint
3. Find the failed event
4. Click **Send test webhook** to retry

---

## Rollback Procedure

If production deployment has issues:

1. **Quick rollback:**
   - Vercel Dashboard → Deployments
   - Find last working deployment
   - Click **⋯** → **Promote to Production**

2. **Fix and redeploy:**
   - Fix issues locally
   - Test thoroughly
   - Push to Git
   - Verify new deployment

---

## Next Steps

After successful production deployment:

1. Set up custom domain (if not using vercel.app):
   - Vercel → Settings → Domains
   - Update `NEXT_PUBLIC_SITE_URL`
   - Update Stripe webhook URL

2. Enable monitoring:
   - Set up error tracking (Sentry, LogRocket)
   - Configure uptime monitoring

3. Performance optimization:
   - Enable Vercel Analytics
   - Review Core Web Vitals

4. Security hardening:
   - Enable Vercel DDoS protection
   - Review Supabase RLS policies
   - Set up rate limiting

---

**Need help?** Check the main [README.md](./README.md) and [SECURITY.md](./SECURITY.md) for additional guidance.
