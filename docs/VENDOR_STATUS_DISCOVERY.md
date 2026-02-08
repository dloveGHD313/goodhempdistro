# Vendor Status Gating — Discovery Summary

## SINGLE SOURCE OF TRUTH
`profiles.vendor_status` — values: `"pending"` | `"active"` (NULL = non-vendor)

---

## A) vendor_status — Read/Write

### Read
| File | Lines | Purpose |
|------|-------|---------|
| `lib/server/vendorStatusGate.ts` | 14–18 | `getVendorStatus()` selects `vendor_status` |
| `lib/server/vendorStatusGate.ts` | 33–37 | `requireVendorActive()` uses `getVendorStatus()` |
| `lib/server/onboardingGate.ts` | 96, 105–110 | `requireVendorOnboarding()` checks `profile?.vendor_status !== "active"` — **BUG: `loadProfile` does not select `vendor_status`** |

### Written
| File | Lines | Purpose |
|------|-------|---------|
| `app/api/vendors/create/route.ts` | 459–462 | Sets `vendor_status: "pending"` when vendor applies |
| `app/api/webhooks/stripe/route.ts` | 607–611 | `handleCheckoutSessionCompleted`: sets `vendor_status: "active"` when subscription active |
| `app/api/webhooks/stripe/route.ts` | 966–976 | `handleSubscriptionChange`: sets `vendor_status: "active"` when subscription active (only if `canPromoteToVendor` — **BUG: skips vendor_status when role is already "vendor"**) |

---

## B) Routes/APIs Needing Gating

### Pages (server layouts)

| Layout | Gate Used | Status |
|--------|-----------|--------|
| `app/vendors/dashboard/layout.tsx` | `requireVendorOnboarding` | OK |
| `app/vendors/events/layout.tsx` | `requireVendorOnboarding` | OK |
| `app/vendors/products/layout.tsx` | `requireVendorOnboarding` | OK |
| `app/vendors/services/layout.tsx` | `requireVendorOnboarding` | OK |
| `app/vendors/settings/layout.tsx` | `requireVendorOnboarding` | OK |
| `app/vendor/layout.tsx` | `requireVendorOnboarding` | OK |
| `app/vendors/billing/layout.tsx` | `getVendorAccessStatus` (subscription_status) | **Gap: uses subscription_status, not vendor_status** |
| `app/vendors/orders/` | No layout | **Gap: only parent requireConsumerOnboarding** |
| `app/vendors/payouts/` | No layout | **Gap** |
| `app/vendors/referrals/` | No layout | **Gap** |

### API Routes

| Route | Gate | Status |
|-------|------|--------|
| `app/api/vendors/create/route.ts` | None (apply endpoint) | OK |
| All other `/api/vendors/*` | `requireVendorActive` | OK |

---

## C) Stripe Path

- **Checkout creation:** `app/api/stripe/checkout/route.ts`, `app/api/stripe/vendor/create-checkout-session/route.ts` (plan_type: "vendor")
- **Webhook:** `app/api/webhooks/stripe/route.ts`
  - `checkout.session.completed` → `handleCheckoutSessionCompleted` (lines 489–618) — sets `vendor_status: "active"` when `VENDOR_ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus)`
  - `customer.subscription.updated` → `handleSubscriptionChange` (lines 913–999) — sets `vendor_status: "active"` only when `canPromoteToVendor` (BUG)
- **Active condition:** `VENDOR_ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"])`

---

## D) Activation Page
`app/vendors/activate/page.tsx` — exists, displays "Choose a plan to activate your vendor account", links to `/pricing?tab=vendor`

---

## BUGS TO FIX
1. **onboardingGate loadProfile** — add `vendor_status` to select; otherwise `profile?.vendor_status` is always undefined.
2. **handleSubscriptionChange** — always set `vendor_status: "active"` when subscription is active; role update can remain conditional.
3. **vendors/billing, orders, payouts, referrals** — add `requireVendorOnboarding` or equivalent vendor_status-based gate.
