# Phase 5 — Logistics + Driver Portal + Delivery Pricing (MVP)

## Discovery summary

### Paths found (existing)
- **app/logistics/apply/page.tsx** — Replaced with two-path UI (was single logistics company form).
- **app/logistics/dashboard**, **app/logistics/routes**, **app/logistics/page.tsx** — Unchanged.
- **app/admin/drivers/page.tsx**, **app/admin/drivers/DriversClient.tsx** — Extended with on-demand driver applications.
- **app/api/admin/drivers/route.ts**, **app/api/admin/drivers/[id]/route.ts** — Unchanged (existing driver_applications flow).
- **app/api/logistics/apply/route.ts** — Unchanged (still used if provider path needs it later).
- **app/api/checkout/create-session/route.ts** — Extended with optional delivery fee computation and order fields.
- **lib/auth/requireAdmin.ts** (admin pages), **lib/auth/requireAdminUsers.ts** (API) — Used as-is.

### Schema (existing)
- **driver_applications** (005) — user_id, full_name, phone, city, state, vehicle_type, status.
- **drivers** (005) — user_id, status; migration 073 adds profile_id, nullable user_id, is_active, service_radius_miles.
- **deliveries** (005) — vendor_id, driver_id, pickup/dropoff, distance_miles, payout_cents, status.
- **orders** (001, 067) — migration 073 adds delivery_* columns.

### Created
- **supabase/migrations/073_phase5_logistics_delivery.sql** — logistics_applications, delivery_pricing (with seed), order delivery columns, drivers extensibility.
- **app/api/logistics/apply/on-demand-driver/route.ts** — POST to create logistics_applications type=on_demand_driver.
- **app/api/admin/drivers/applications/route.ts** — GET list (query status).
- **app/api/admin/drivers/applications/[id]/route.ts** — GET one.
- **app/api/admin/drivers/applications/[id]/approve/route.ts** — POST approve (updates application, creates drivers row).
- **app/api/admin/drivers/applications/[id]/reject/route.ts** — POST reject.
- **lib/server/deliveryPricing.ts** — getActiveDeliveryPricing, computeCustomerDeliveryFee, computeDriverDeliveryEstimate, haversineMiles, computeDeliveryFees.

### Modified
- **app/logistics/apply/page.tsx** — Two-path: Option 1 → vendor-registration?intent=logistics_provider; Option 2 → on-demand driver form → POST on-demand-driver API.
- **app/admin/drivers/page.tsx** — Fetches on-demand applications from logistics_applications; passes to DriversClient.
- **app/admin/drivers/DriversClient.tsx** — Section "On-Demand Driver Applications" with approve/reject calling new APIs.
- **components/Nav.tsx** — Admin dropdown: added "Drivers" link.
- **app/api/checkout/create-session/route.ts** — Optional delivery_selected, delivery_distance_miles or vendor/customer lat-lng; computes delivery fees; stores on order; adds delivery line item to Stripe when applicable.

## Visibility rules (MVP)
- **Customers:** See only delivery_fee_customer (and Stripe line item "Delivery fee").
- **Drivers:** See only delivery_fee_driver_estimate + tip (tip separate; driver-facing UI not built in this PR).
- **Vendors:** When vendor pays (B2B), show delivery fee they pay; when customer pays, existing order breakdown only (no platform margin).
- **Admin:** Can see all fields including delivery_margin (admin order views unchanged; payload stripping by role can be added in order APIs later).

## How to test
1. **Run migration:** `073_phase5_logistics_delivery.sql` in Supabase SQL Editor (or apply via CLI).
2. **Logistics apply:** Visit `/logistics/apply`. Choose Option 1 → redirects to vendor-registration with `?intent=logistics_provider`. Choose Option 2 → fill form, submit → application received; row in logistics_applications (type=on_demand_driver, status=pending).
3. **Admin drivers:** As admin, open Admin → Drivers. See "On-Demand Driver Applications" table. Approve → logistics_applications updated, drivers row created (user_id from profile by email if found). Reject → status=rejected, optional rejection_reason.
4. **Checkout with delivery:** POST /api/checkout/create-session with body `{ product_id, quantity, delivery_selected: true, delivery_distance_miles: 5 }` (or vendor_lat, vendor_lng, customer_lat, customer_lng). Order should have delivery_* fields; Stripe session includes "Delivery fee" line item.
5. **Vendor onboarding / vendor checkout:** No changes; Phase 3/4 flows and webhooks unchanged.

## Known limitations
- Plan filtering for intent=logistics_provider (limit to higher tiers on pricing/checkout) not implemented in this PR.
- Order payload visibility (strip delivery_margin for non-admin) not enforced in existing order APIs; recommend adding when order detail API is used.
- Driver app / driver-facing delivery list not in scope.
