# Phase 6 Cleanup — Logistics Routing Unification + Cadence Runtime Guard

## Discovery summary

### Routes that existed (before)

| Route | Purpose | Notes |
|-------|---------|-------|
| `/logistics` | Landing + inline Request Delivery form | Had Driver Funnel, Logistics Command, For Drivers/For Businesses cards, Pay Scale, and inline delivery request form |
| `/logistics/apply` | Two-path funnel | Option A → vendor-registration?intent=logistics_provider; Option B → on-demand driver form → POST /api/logistics/apply/on-demand-driver |
| `/driver-apply` | Separate driver application | Full form with docs (license, insurance, MVR), POST /api/drivers/apply — **duplicated entry point** |
| `/logistics/dashboard` | Driver/logistics dashboard | Unchanged |
| `/logistics/routes` | Delivery matching preview | Unchanged |

### Links to “Apply as Driver” / “Register Logistics Company”

- `/logistics` — “Apply as Driver” → `/driver-apply`; “Register Logistics Company” → `/logistics/apply`
- `/logistics` — “Apply to drive” (Driver Funnel) → `/driver-apply`
- `MascotAssistant` — “Apply to drive” → `/driver-apply`
- `/driver/dashboard` — “Reapply” / “Apply Now” → `/driver-apply`

### Duplicated logic

- **Two driver application flows:** `/driver-apply` (docs-based, /api/drivers/apply) vs `/logistics/apply` Option B (simpler, /api/logistics/apply/on-demand-driver)
- Target: Single funnel at `/logistics/apply` for both “Apply as Driver” and “Register Logistics Company”

---

## What changed

### 1. Cadence runtime bug fix (`app/api/stripe/checkout/route.ts`)

- **Problem:** `(cadence as string).toLowerCase()` could crash if `cadence` was not a string (e.g. number, object).
- **Fix:**
  - Validate `typeof cadence !== "string"` before `toLowerCase()`
  - Return 400 with `{ error: "Invalid cadence type" }` when invalid
  - Allowed values: `monthly`, `annual`, `year` (all others rejected)

### 2. `/logistics` — informational landing only

- **Before:** Driver Funnel, Logistics Command, For Drivers/For Businesses cards, Pay Scale, inline Request Delivery form.
- **After:** Simple landing with three buttons and Pay Scale.
- **Buttons:**
  - **Apply as Driver** → `/logistics/apply`
  - **Request Delivery** → `/logistics/request`
  - **Register Logistics Company** → `/logistics/apply`
- **No forms** on this page.

### 3. `/logistics/request` — new page

- Moved the delivery request form from `/logistics` to `/logistics/request`.
- Same API (`POST /api/deliveries/request`) and behavior.

### 4. `/logistics/apply` — single canonical funnel

- **Provider option:** Route changed from `/vendor-registration?intent=logistics_provider` to `/pricing?tab=vendor`.
- **Card text (Provider):** “You negotiate pricing directly with vendors. Good Hemp Distro functions as a discovery & directory platform.”
- **Card text (On-Demand Driver):** “Good Hemp Distro sets delivery pricing. You're paid per delivery + keep 100% of tips.”
- Both “Apply as Driver” and “Register Logistics Company” use this funnel.

### 5. `/driver-apply` → redirect to `/logistics/apply`

- `/driver-apply` now immediately redirects to `/logistics/apply`.
- Unifies all driver application entry points.

### 6. Link updates

- `MascotAssistant` — “Apply to drive” → `/logistics/apply`
- `/driver/dashboard` — “Reapply” / “Apply Now” → `/logistics/apply`

---

## How to test

1. **Apply as Driver**
   - Click “Apply as Driver” on `/logistics` → goes to `/logistics/apply`.
   - Click “Apply to drive” in MascotAssistant → goes to `/logistics/apply`.
   - Visit `/driver-apply` directly → redirects to `/logistics/apply`.
   - On `/logistics/apply`, choose On-Demand Driver, fill form, submit → application received.

2. **Register Logistics Company**
   - Click “Register Logistics Company” on `/logistics` → goes to `/logistics/apply`.
   - On `/logistics/apply`, choose Delivery Provider Listing, click Continue → goes to `/pricing?tab=vendor`.

3. **Request Delivery**
   - Click “Request Delivery” on `/logistics` → goes to `/logistics/request`.
   - Submit form → delivery request created (requires login + vendor account).

4. **Cadence validation**
   - `POST /api/stripe/checkout` with `cadence: 123` (number) → 400, “Invalid cadence type”.
   - `POST /api/stripe/checkout` with `cadence: {}` → 400, “Invalid cadence type”.
   - `POST /api/stripe/checkout` with `cadence: "monthly"` (and valid planKey) → proceeds as expected.

5. **Vendor pricing**
   - Visit `/pricing?tab=vendor` and complete checkout → no change from Phase 6 vendor pricing work.

---

## Confirmation: no vendor pricing regression

- Vendor pricing values, Stripe price IDs, `planMapping`, delivery pricing math, and driver pay rates were **not modified**.
- Cadence fix only adds validation; allowed values (`monthly`, `annual`, `year`) match what the pricing UI sends.
