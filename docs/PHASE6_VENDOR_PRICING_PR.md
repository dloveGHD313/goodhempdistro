# Phase 6: Vendor Pricing Fix — PR Summary

## Discovery summary

### 1) Vendor pricing UI sources
- **Display:** `/pricing` (vendor tab) → `GET /api/pricing/vendor-plans` → `getVendorPlanConfigs()` in **`lib/pricing.ts`**.
- Plan cards and price labels (e.g. `headlinePriceText`: "$70/month", "$714/year") come from `lib/pricing.ts` only.
- No computed annual-from-monthly logic; annual prices are explicit in config.

### 2) Vendor checkout / Stripe session creation
- **Main path:** Pricing page → `POST /api/stripe/checkout` with `productType: "vendor"`, `planKey`, `cadence`. Uses **`resolveVendorPriceId(planKey, cadence)`** and **`getVendorPlanByPriceId(priceId)`** from **`lib/pricing.ts`** (env-based).
- **Legacy path:** `POST /api/stripe/vendor/create-checkout-session` previously used **`STRIPE_PRICES`** in `lib/stripe/prices.ts` with wrong mapping (VENDOR_GROWTH → Pro env, VENDOR_PRO → Enterprise env) and monthly-only; now uses **`lib/pricing`** for resolution.

### 3) Env var usage
- **Vendor env vars (Vercel):**  
  `STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID`, `STRIPE_VENDOR_STARTER_ANNUAL_PRICE_ID`,  
  `STRIPE_VENDOR_PRO_MONTHLY_PRICE_ID`, `STRIPE_VENDOR_PRO_ANNUAL_PRICE_ID`,  
  `STRIPE_VENDOR_ENTERPRISE_MONTHLY_PRICE_ID`, `STRIPE_VENDOR_ENTERPRISE_ANNUAL_PRICE_ID`.
- **Single source of truth:** `lib/pricing.ts` reads these exclusively; no hardcoded vendor price IDs.

### 4) Mismatches resolved
- **Removed:** `VENDOR_GROWTH` and dev fallbacks in `lib/stripe/prices.ts`; vendor keys now read with `getEnv()` only (no fallbacks).
- **Fixed:** `lib/stripe/prices.ts` vendor section: three tiers only — `VENDOR_STARTER`, `VENDOR_PRO`, `VENDOR_ENTERPRISE` — each mapped to the correct env vars.
- **Fixed:** `lib/stripe/planMapping.ts`: vendor priceId → internal planKey now maps Starter → vendor_starter_*, Pro → vendor_pro_*, Enterprise → vendor_enterprise_* (removed Growth; Enterprise no longer incorrectly mapped from old VENDOR_PRO).

---

## What changed

1. **`lib/stripe/prices.ts`**
   - Vendor prices read **only** from `process.env` via `getEnv()` (no `getEnvOrDevFallback`).
   - Removed `VENDOR_GROWTH`.
   - `VENDOR_PRO` now uses `STRIPE_VENDOR_PRO_*` env vars.
   - Added `VENDOR_ENTERPRISE` using `STRIPE_VENDOR_ENTERPRISE_*` env vars.

2. **`lib/stripe/planMapping.ts`**
   - Vendor mappings: Starter, Pro, Enterprise only; `VENDOR_ENTERPRISE` → `vendor_enterprise_monthly` / `vendor_enterprise_annual`.
   - Ensures webhook `getInternalPlanFromStripePriceId(priceId)` resolves vendor price IDs correctly when env is set.

3. **`lib/pricing.ts`**
   - Added `resolveVendorPriceIdOrThrow(planKey, billingInterval)` for strict server-side use (throws if env missing or invalid planKey).
   - Display config unchanged: Starter $70/$714, Pro $150/$1,530, Enterprise $275/$2,805 (explicit, not computed).

4. **`app/api/stripe/checkout/route.ts`**
   - Explicit allowlist for `planKey` and valid `cadence` (monthly/annual); returns 400 for invalid vendor plan or interval.
   - Continues to resolve `priceId` only via `resolveVendorPriceId()` from `lib/pricing`.

5. **`app/api/stripe/vendor/create-checkout-session/route.ts`**
   - Removed dependency on `STRIPE_PRICES` and `PlanKey`.
   - Resolves `priceId` via `lib/pricing`: `planNameToPlanKey(planName)` → `resolveVendorPriceId(planKey, "monthly")`.
   - Legacy plan names (e.g. "growth") map to Pro for backwards compatibility.

---

## How to test

1. **Build:** `npm ci` and `npm run build` (both pass).
2. **Vendor pricing page:** Visit `/pricing?tab=vendor`.
   - Confirm displayed amounts: Starter $70/month, $714/year; Pro $150/month, $1,530/year; Enterprise $275/month, $2,805/year.
3. **Checkout:** For each plan, click "Start checkout" (monthly and annual).
   - Confirm Stripe Checkout shows the same amounts as above.
   - Complete a test subscription and confirm success.
4. **Legacy route (optional):** If any flow uses `POST /api/stripe/vendor/create-checkout-session` with `planName`, confirm it still creates a session (monthly only, resolved via `lib/pricing`).

---

## Confirmation: consumer pricing untouched

- **Consumer** price IDs remain hardcoded in `STRIPE_PRICES` (CONSUMER_BASIC, CONSUMER_PLUS, CONSUMER_PREMIUM); no changes.
- **Consumer checkout** (`/api/subscriptions/checkout`, consumer path in `/api/stripe/checkout`) and **delivery / logistics pricing** were not modified.
- **Stripe webhooks** still use `getInternalPlanFromStripePriceId()`; vendor mapping now aligns with env-based vendor price IDs; no change to webhook activation logic.

---

## Stop conditions satisfied

- No vendor price comes from a constant, JSON config, or math; all from env via `lib/pricing.ts` and `lib/stripe/prices.ts` (vendor section).
- No hardcoded or stale vendor Stripe price IDs in code paths that create checkout sessions.
- Single authoritative vendor pricing resolver: `lib/pricing.ts` (with `lib/stripe/planMapping.ts` kept in sync for webhook resolution).
