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

## Bugbot fixes (Phase 5) — PR #60

### Discovery (files touched)
- **Delivery fee + distance:** `app/api/checkout/create-session/route.ts`, `lib/server/deliveryPricing.ts` (haversineMiles, computeDeliveryFees). No prior coordinate validation helpers.
- **Admin approve:** `app/api/admin/drivers/applications/[id]/approve/route.ts`, `app/api/admin/drivers/applications/[id]/reject/route.ts`. Drivers schema: `supabase/migrations/005_compliance_logistics.sql` (drivers table), `073_phase5_logistics_delivery.sql` (profile_id, nullable user_id, service_radius_miles, is_active). `logistics_applications`: 073 (type, full_name, email, phone, status, reviewed_by, reviewed_at, rejection_reason).
- **RPC:** Repo uses SECURITY DEFINER RPCs (e.g. `011_admin_list_vendor_applications_rpc.sql`). Admin gating via `admin_users` + `requireAdminUsers` in API.

### Changes made

**Fix #1 — NaN/Infinity coordinate validation (checkout)**  
- **File:** `app/api/checkout/create-session/route.ts`
- Added `parseFiniteNumber(value): number | null` (returns number only if `Number.isFinite`).
- Added `validateLatLng(lat, lng): boolean` (lat ∈ [-90, 90], lng ∈ [-180, 180], finite).
- `delivery_distance_miles`: accept only if `Number.isFinite` and ≥ 0; else ignore and fall back to coords or 400.
- When using coords: require all 4 present and `validateLatLng` for both pairs; compute haversine; require `Number.isFinite(distanceMiles)` and ≥ 0 else 400 "Distance unavailable for delivery".
- After `computeDeliveryFees`: require `Number.isFinite(deliveryFeeCustomer)` and ≥ 0 else 500 "Delivery fee unavailable".
- Stripe line item: only add "Delivery fee" when `Number.isFinite(deliveryFeeCustomer)` and `deliveryFeeCustomer > 0`.

**Fix #2 + #3 — Atomic driver approve + no orphan drivers**  
- **Migration:** `supabase/migrations/074_phase5_driver_approve_atomic.sql`
  - `drivers`: added `application_id` (UUID, FK to logistics_applications), `applicant_email`, `applicant_name`, `applicant_phone`.
  - Unique index on `application_id` (WHERE application_id IS NOT NULL).
  - Index on `lower(applicant_email)` (WHERE applicant_email IS NOT NULL).
  - New RPC `admin_approve_driver_application(p_application_id uuid, p_admin_user_id uuid)` (SECURITY DEFINER):
    - Verifies caller in `admin_users`.
    - Locks application row (FOR UPDATE), validates status = 'pending'.
    - Inserts driver with `application_id`, `applicant_email`, `applicant_name`, `applicant_phone`, `profile_id`/`user_id` if profile found by email.
    - Updates application to approved, reviewed_by, reviewed_at.
    - Returns driver id.
- **File:** `app/api/admin/drivers/applications/[id]/approve/route.ts`
  - Calls RPC only; no application-update-then-driver-insert in app code.
  - On RPC error: 400 for "already reviewed" / P0001 / 23505 (duplicate), 403 for "not admin", 500 otherwise. Never returns success unless driver is created.
  - Response: `{ success: true, driverIdSuffix?: "<last-8-chars>" }` (no full UUID in body).

**Verification script**  
- `scripts/phase5-checkout-delivery-validate.mjs` — prints curl examples for NaN/Infinity coords (expect 400), valid distance (expect 200 + delivery line item), valid coords (expect 200).

### Migration 074 — How to run
1. Apply `073_phase5_logistics_delivery.sql` if not already applied.
2. In Supabase SQL Editor (or CLI): run `supabase/migrations/074_phase5_driver_approve_atomic.sql`.
3. No other manual steps.

### How to test (bugbot fixes)
1. **Checkout create-session**
   - `delivery_selected: true` with NaN or Infinity in any of vendor_lat/vendor_lng/customer_lat/customer_lng → expect **400** "Distance unavailable for delivery", no Stripe session.
   - `delivery_selected: true` with valid coords (all four, in range) → expect **200**, Stripe session with "Delivery fee" line item when fee > 0.
   - `delivery_selected: true` with valid `delivery_distance_miles` (finite, ≥ 0) → expect **200**, session with delivery line item.
2. **Admin approve**
   - Approve a pending on-demand application → expect **200** `{ success: true, driverIdSuffix?: "..." }`; driver row exists with `application_id` and applicant_* filled; application status = approved.
   - Approve the same application again → expect **400** "Application already approved (driver already exists)", not success.

### Build
- `npm ci` and `npm run build` pass.

---

## Known limitations
- Plan filtering for intent=logistics_provider (limit to higher tiers on pricing/checkout) not implemented in this PR.
- Order payload visibility (strip delivery_margin for non-admin) not enforced in existing order APIs; recommend adding when order detail API is used.
- Driver app / driver-facing delivery list not in scope.
