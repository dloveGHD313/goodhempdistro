# Quick Reference: Vercel Setup Checklist

## ✅ Code Changes Completed

- [x] **Turbopack alias resolution added** (`next.config.ts`)
  - Fixes "Can't resolve '@lib/...'" errors in Vercel builds
- [x] **Custom landing page created** (`app/page.tsx`)
  - Professional marketplace UI instead of Next.js boilerplate
- [x] **Dependencies verified**
  - All production packages (Stripe, Supabase) in `dependencies` section
- [x] **Build tested locally**
  - No module resolution errors
  - All routes compile successfully
  - Tests pass (7/7)

---

## 🎯 Vercel Setup Steps (Do This on Vercel Dashboard)

### 1. Add Environment Variables
Go to: **Project Settings → Environment Variables**

Add these 7 variables (get values from your `.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL          → from Supabase Dashboard
NEXT_PUBLIC_SUPABASE_ANON_KEY     → from Supabase Dashboard
STRIPE_SECRET_KEY                 → from Stripe Dashboard (Live keys for prod)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY → from Stripe Dashboard
STRIPE_WEBHOOK_SECRET             → from Stripe Webhook endpoint
NEXT_PUBLIC_SITE_URL              → your Vercel domain (e.g., https://app.vercel.app)
SUPABASE_SERVICE_ROLE_KEY         → from Supabase Dashboard
```

**Important:** 
- Use LIVE Stripe keys for production (not test keys)
- Set environment to "Production"
- Variables starting with `NEXT_PUBLIC_` are exposed to browser (don't put secrets there)

### 2. Deploy
- Push to `main` branch (or click "Deploy" in Vercel dashboard)
- Wait for build to complete
- Check **Deployments** tab for any errors

### 3. Verify
- Open your production URL
- Confirm you see the **Good Hemp Distro marketplace landing page** (not default Next.js page)
- Test navigation to `/products` and other routes
- Check browser console for no module resolution errors

### 4. Test Stripe Webhook
- Go to Stripe Dashboard → Developers → Webhooks
- Find your webhook endpoint
- Verify it shows 200 responses for recent events
- If errors, check Vercel Function Logs for the API route `/api/webhooks/stripe`

---

## 🔍 Troubleshooting

### Build Fails with "Can't resolve '@lib/...'"
- **Status:** ✅ FIXED in this PR
- Ensure you're using Next.js 16+ with Turbopack
- Check `next.config.ts` has `turbopack.resolveAlias` section

### Webhook Returns 500 Error
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
- Check Supabase credentials (`SUPABASE_SERVICE_ROLE_KEY`)
- Look at Vercel Function Logs for the exact error

### Environment Variables Not Loading
- Redeploy after adding variables
- Verify variables are set for "Production" environment
- Don't include trailing slashes in URLs

### Landing Page Still Shows "Getting Started"
- Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
- Check `/` route in Vercel Deployments logs
- Verify `app/page.tsx` was updated

---

## 📚 Related Docs

- [DEPLOY_PRODUCTION.md](./DEPLOY_PRODUCTION.md) – Full production deployment guide
- [VERCEL_DEPLOYMENT_FIX.md](./VERCEL_DEPLOYMENT_FIX.md) – Detailed fix summary
- [Stripe API Keys](https://dashboard.stripe.com/apikeys)
- [Supabase Settings](https://app.supabase.com/project/_/settings/api)

---

## Latest Commits

```
fe54238 docs: add Vercel deployment fix summary
6bb7419 fix: add Turbopack alias resolution and replace default landing page
```

Ready to deploy! 🚀
