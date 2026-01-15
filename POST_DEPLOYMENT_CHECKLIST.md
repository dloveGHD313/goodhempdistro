# 🚀 Post-Deployment Verification Checklist (Interactive)

Use this checklist **after** you've deployed to Vercel and added environment variables.

---

## Phase 1: Build & Deployment ✓ Verify on Vercel Dashboard

### 1.1 Build Succeeded
**Location:** Vercel Dashboard → Deployments → click your latest deployment

- [ ] Green checkmark shows deployment succeeded
- [ ] Build logs show: `✓ Compiled successfully`
- [ ] **NO errors containing:**
  - ❌ "Module not found"
  - ❌ "Can't resolve '@lib'"
  - ❌ "Cannot find module"
  - ❌ "NEXT_PUBLIC_SUPABASE_URL is not defined"

**If failed:** Check the logs. If you see module errors, ensure:
1. `next.config.ts` has `turbopack.resolveAlias` section
2. All 7 env vars are added to Vercel (Settings → Environment Variables)
3. Redeploy after adding vars

---

## Phase 2: Homepage & UI ✓ Verify in Browser

### 2.1 Homepage Renders
**Action:** Open your Vercel URL in browser

- [ ] Page loads without errors (no blank page or crash)
- [ ] Page shows "Good Hemp Distro" heading and logo (🌿)
- [ ] You see the custom landing page (NOT the default Next.js "Getting Started" page)
- [ ] No console errors (open DevTools → Console tab)

**What you SHOULD see:**
```
🌿 Good Hemp Distro
Products | Account

Premium Hemp Products Marketplace
[Shop Now button]

✓ Secure Checkout
✓ Fast Shipping  
✓ Verified Products
```

**What you SHOULD NOT see:**
```
❌ "To get started, edit the page.tsx file"
❌ Next.js logo
❌ Vercel logo
❌ "Deploy Now" button linking to Vercel
```

### 2.2 Navigation Works
**Action:** Click links on the page

- [ ] "Products" link navigates to `/products` (or shows 404 if page doesn't exist yet — that's OK)
- [ ] "Account" link navigates or calls logout (should work)
- [ ] No 404 errors for navigation itself
- [ ] No console errors during navigation

### 2.3 No Console Errors
**Action:** Open DevTools (F12 or Cmd+Opt+I) → Console tab

- [ ] No red error messages
- [ ] No "ReferenceError: process.env..." messages
- [ ] No "Cannot find module" errors
- [ ] No 400/500 HTTP errors visible in Network tab

---

## Phase 3: Supabase Integration ✓ Verify Data Loading

### 3.1 Supabase Connection
**If your app fetches data from Supabase on page load:**

- [ ] Data loads successfully (check browser Network tab for Supabase API calls)
- [ ] No "401 Unauthorized" or "invalid API key" errors
- [ ] If you have a user profile/dashboard, it shows user data correctly

**If you see errors like:**
- ❌ "Invalid API token" → Check `NEXT_PUBLIC_SUPABASE_ANON_KEY` on Vercel
- ❌ "401 Unauthorized" → Verify Supabase project is active and key is correct

### 3.2 Authentication (if applicable)
**Action:** Try logging in or accessing protected routes

- [ ] Login page loads (if you have one)
- [ ] Can submit login form without errors
- [ ] Supabase session is created (check cookies in DevTools)
- [ ] Authenticated routes don't show 401 errors

---

## Phase 4: Stripe Integration ✓ Verify Webhooks & Payments

### 4.1 Webhook Endpoint is Reachable
**Location:** Stripe Dashboard → Developers → Webhooks

- [ ] Find your production webhook (URL: `https://your-vercel-domain.com/api/webhooks/stripe`)
- [ ] It shows as "Active" (green status)
- [ ] Click on it to view recent events

### 4.2 Recent Webhook Events Show Success
**Location:** Stripe webhook details → Events tab

- [ ] Recent events are listed (if any have been sent)
- [ ] All events show ✅ 200 response code (success)
- [ ] No events show 4xx or 5xx error codes

**If you see errors:**
- [ ] Click on a failed event to see the error details
- [ ] Check Vercel Function Logs (Monitoring → Function Logs tab) for `/api/webhooks/stripe`
- [ ] Verify `STRIPE_WEBHOOK_SECRET` matches the signing secret in Stripe

### 4.3 Test Webhook Event (Optional)
**Location:** Stripe webhook details

- [ ] Click "Send test webhook" for `checkout.session.completed` event
- [ ] In Stripe, verify it returns 200 response
- [ ] Check Vercel Function Logs to see the request was processed

### 4.4 Stripe Payment Flow (if applicable)
**Action:** If you have a checkout/payment button:

- [ ] Checkout page loads without errors
- [ ] Can fill in test credit card details
- [ ] Payment form doesn't show Stripe API key errors
- [ ] Using test keys locally and LIVE keys in production (verify in code and Vercel)

**Test card numbers:**
- ✅ `4242 4242 4242 4242` (successful payment)
- ✅ `4000 0000 0000 0002` (card decline test)

---

## Phase 5: Environment Variables ✓ Verify All Are Loaded

### 5.1 Check Vercel Environment Settings
**Location:** Vercel Dashboard → Settings → Environment Variables

- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set
- [ ] `STRIPE_SECRET_KEY` is set (uses `sk_live_...` for production)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set (uses `pk_live_...` for production)
- [ ] `STRIPE_WEBHOOK_SECRET` is set (starts with `whsec_...`)
- [ ] `NEXT_PUBLIC_SITE_URL` is set to your Vercel domain
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set

### 5.2 Verify Env Vars Are Used in Deployed Build
**Action:** Open DevTools → Network tab → click on a request to an API route

- [ ] API routes respond with 200 (not 500 with "env var is undefined" error)
- [ ] If you see 500 errors, check Vercel Function Logs for missing var errors

---

## Phase 6: API Routes ✓ Verify All Routes Work

### 6.1 Test `/api/auth/logout`
**Action (if you have a logout button):**

- [ ] Click logout
- [ ] Function completes without 500 error
- [ ] Check Vercel Logs (Monitoring → Function Logs) for successful execution
- [ ] Supabase session is cleared (cookies are deleted)

### 6.2 Test `/api/orders/confirm`
**Action (if you have an order confirmation flow):**

- [ ] Endpoint receives POST request with valid `sessionId`
- [ ] Stripe session is retrieved successfully (no "invalid session" errors)
- [ ] Order is updated in Supabase (status changes from "pending" to "paid")
- [ ] Check Vercel Function Logs for successful 200 response

### 6.3 Test `/api/webhooks/stripe`
**Verified above in Phase 4.** Should show:
- [ ] 200 responses for all events
- [ ] No 500 or 401 errors in Vercel Function Logs

---

## Phase 7: Final Sanity Check ✓ General Functionality

### 7.1 No Runtime Errors
**Action:** Use the app normally for 5-10 minutes

- [ ] Navigate between pages (if they exist)
- [ ] No 500 errors on any page
- [ ] No unhandled exceptions in console
- [ ] Page refresh works without errors

### 7.2 Vercel Function Logs Look Clean
**Location:** Vercel Dashboard → Monitoring → Function Logs

- [ ] No repeated error messages
- [ ] All requests show 200-level status codes
- [ ] No "Cannot find module" or "ReferenceError" messages
- [ ] Log lines show expected output (e.g., Stripe webhook processing logs)

### 7.3 Production vs. Development
**Verify:**
- [ ] Using LIVE Stripe keys (not test keys)
- [ ] Using production Supabase project (not development)
- [ ] `NEXT_PUBLIC_SITE_URL` points to your production domain (not localhost)

---

## 🎉 Checklist Summary

Print or copy this:

```
Local Build:          [✓] Passed
Homepage:             [ ] Loads custom content
Supabase:             [ ] Connects & fetches data
Stripe Webhooks:      [ ] Show 200 responses
Env Variables:        [ ] All 7 set on Vercel
API Routes:           [ ] No 500 errors
No Console Errors:    [ ] Clean console
Production Keys:      [ ] Using LIVE, not test
General Functionality:[ ] App works as expected
```

---

## Troubleshooting Quick Links

| Issue | Where to Check | Action |
|-------|----------------|--------|
| Build failed | Vercel Dashboard → Deployments → [click build] | View build logs, look for module errors |
| Env var undefined | Vercel → Settings → Environment Variables | Add missing variable, redeploy |
| API 500 error | Vercel → Monitoring → Function Logs | Filter for `/api/...` route, check error |
| Stripe webhook failed | Stripe Dashboard → Webhooks → [click endpoint] → Events | See error details, check signing secret |
| Homepage shows default page | Browser console | Check if `app/page.tsx` was deployed |
| Supabase "401 Unauthorized" | Browser Network tab | Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` on Vercel |

---

## Success Criteria

✅ **All green?** Deployment is complete and working!

❌ **Any red?** Debug using the table above, then redeploy.

---

**Last updated:** January 15, 2026  
**Deployment:** Good Hemp Distro (goodhempdistro.vercel.app)
