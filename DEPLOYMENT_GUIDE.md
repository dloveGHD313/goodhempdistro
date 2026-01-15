# 📋 Complete Deployment & Verification Guide

This guide walks you through the complete post-push deployment verification for Good Hemp Distro on Vercel.

---

## 📍 You Are Here

**Current Status:** Code is pushed, ready for Vercel env var configuration and deployment.

**What's Happened:**
- ✅ Turbopack alias resolution added (`next.config.ts`)
- ✅ Custom landing page created (`app/page.tsx`)
- ✅ All modules resolve correctly locally
- ✅ Tests pass (7/7)
- ✅ Production build succeeds locally

**What's Next:**
1. Add environment variables to Vercel
2. Deploy to Vercel
3. Verify everything works

---

## 🎯 Quick Start (5 minutes)

### Step 1: Add Environment Variables to Vercel

1. Go to your Vercel project: [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your "goodhempdistro" project
3. Go to **Settings → Environment Variables**
4. Add these 7 variables (copy values from your `.env.local` file):

```
Key                              | Value
─────────────────────────────────┼─────────────────────────────
NEXT_PUBLIC_SUPABASE_URL         | https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY    | eyJhbGc...
STRIPE_SECRET_KEY                | sk_live_... (IMPORTANT: Use LIVE key)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | pk_live_...
STRIPE_WEBHOOK_SECRET            | whsec_...
NEXT_PUBLIC_SITE_URL             | https://goodhempdistro.vercel.app
SUPABASE_SERVICE_ROLE_KEY        | eyJhbGc...
```

⚠️ **Important:** Set each variable for "Production" environment only.

### Step 2: Deploy

**Option A (Recommended):** Push to GitHub
```bash
git push origin main
```

**Option B:** Manually redeploy in Vercel dashboard
1. Go to Deployments tab
2. Click "Redeploy" on the latest deployment

### Step 3: Wait & Verify

- Vercel will build (~2-3 minutes)
- Check Deployments tab for success (green checkmark)
- Visit your live URL

**Expected Result:**
- Page loads with custom landing page (🌿 Good Hemp Distro header)
- No errors in browser console
- No module resolution errors in build logs

---

## 📚 Full Documentation

Once deployed, use these guides for verification:

### Pre-Deployment (Already Verified ✅)
→ Read: **[VERIFICATION_REPORT.md](./VERIFICATION_REPORT.md)**
- Confirms local build passes
- Lists all module resolution fixes
- Shows env var configuration

### Post-Deployment (Use After Deploy)
→ Read: **[POST_DEPLOYMENT_CHECKLIST.md](./POST_DEPLOYMENT_CHECKLIST.md)**
- Interactive checklist with 7 phases
- Browser verification steps
- Stripe webhook testing
- Troubleshooting guide

### Deployment Reference
→ Read: **[VERCEL_SETUP_CHECKLIST.md](./VERCEL_SETUP_CHECKLIST.md)**
- Quick reference for env vars
- Vercel configuration steps
- Common issues and fixes

### Production Deployment
→ Read: **[DEPLOY_PRODUCTION.md](./DEPLOY_PRODUCTION.md)**
- Full step-by-step guide
- Supabase + Stripe setup
- Security checklist
- Monitoring setup

---

## 🔍 What Will Be Verified

After you follow the 5-minute quick start above, here's what you'll verify:

### ✅ Build (Vercel Logs)
- No "Module not found" errors
- No "Can't resolve '@lib/...'" errors
- Status: "Compiled successfully"

### ✅ Homepage (Browser)
- Custom landing page loads
- Header shows "🌿 Good Hemp Distro"
- Navigation works
- No console errors

### ✅ Environment (Backend)
- All 7 env vars loaded successfully
- No "process.env.XXX is undefined" errors
- API routes respond with 200 status

### ✅ Stripe (Webhook)
- Webhook endpoint shows "Active"
- Recent events show 200 responses
- No authentication errors

### ✅ Supabase (Database)
- Data queries succeed
- No "401 Unauthorized" errors
- Session management works

---

## ⚠️ Common Issues & Fixes

### Issue: Build fails with module errors
**Fix:** Ensure all 7 env vars are set in Vercel BEFORE deploying. Redeploy after adding them.

### Issue: Homepage shows default "Getting Started" page
**Fix:** Hard refresh browser (Ctrl+Shift+R). Check that Vercel deployment includes latest `app/page.tsx`.

### Issue: Stripe webhook returns 500 error
**Fix:** Check Vercel Function Logs for `/api/webhooks/stripe`. Likely cause: missing `STRIPE_WEBHOOK_SECRET` or `SUPABASE_SERVICE_ROLE_KEY`.

### Issue: Supabase returns 401 Unauthorized
**Fix:** Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct on Vercel. Should match your Supabase project.

---

## 📞 Need Help?

### For Build Errors:
1. Check Vercel build logs: Dashboard → Deployments → [click build] → View logs
2. Look for "Module not found" or "Cannot find"
3. Verify env vars are set correctly

### For Runtime Errors:
1. Check Vercel Function Logs: Dashboard → Monitoring → Function Logs
2. Filter by route (e.g., `/api/webhooks/stripe`)
3. Look for 500 errors and error messages

### For Stripe Issues:
1. Stripe Dashboard → Developers → Webhooks
2. Click your endpoint → view event logs
3. See response code and error details

### For Supabase Issues:
1. Browser DevTools → Network tab
2. Look for Supabase API calls (ending in `.supabase.co`)
3. Check response status and error message

---

## 📈 Success Path

```
┌─────────────────────────┐
│  Code Changes Done ✅   │  (You're here)
│  - Turbopack aliases    │
│  - Landing page         │
│  - Env validation       │
└──────────────┬──────────┘
               │
               ▼
┌─────────────────────────┐
│  Add Env Vars on Vercel │  (Next step)
│  - 7 environment vars   │
│  - Set Production env   │
└──────────────┬──────────┘
               │
               ▼
┌─────────────────────────┐
│  Deploy to Vercel       │
│  - Push to main or      │
│  - Click Redeploy       │
└──────────────┬──────────┘
               │
               ▼
┌─────────────────────────┐
│  Verify in Browser      │
│  - Check homepage       │
│  - Test navigation      │
│  - No console errors    │
└──────────────┬──────────┘
               │
               ▼
┌─────────────────────────┐
│  Test Integrations      │
│  - Stripe webhooks      │
│  - Supabase queries     │
│  - API routes           │
└──────────────┬──────────┘
               │
               ▼
┌─────────────────────────┐
│  ✅ DEPLOYMENT SUCCESS  │
│  App live and working! 🚀│
└─────────────────────────┘
```

---

## 🚀 You're Ready!

1. **Add env vars to Vercel** (5 min)
2. **Deploy** (2-3 min)
3. **Verify using checklist** (5-10 min)

**Total time: ~15 minutes** ⏱️

Then your Good Hemp Distro marketplace is live on Vercel! 🌿

---

## 📝 Files Summary

| File | Purpose | Status |
|------|---------|--------|
| `next.config.ts` | Turbopack alias resolution | ✅ Done |
| `app/page.tsx` | Custom landing page | ✅ Done |
| `VERIFY_REPORT.md` | Pre-deployment checklist | ✅ Done |
| `POST_DEPLOYMENT_CHECKLIST.md` | Interactive verification | 📖 Use after deploy |
| `VERCEL_SETUP_CHECKLIST.md` | Quick reference | 📖 Reference |
| `DEPLOY_PRODUCTION.md` | Full deployment guide | 📖 Reference |

---

**Date:** January 15, 2026  
**Project:** Good Hemp Distro  
**Status:** Ready for Vercel deployment ✅
