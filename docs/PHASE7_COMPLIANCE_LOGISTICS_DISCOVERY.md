# Phase 7: Compliance-Accurate Logistics — Discovery Summary

## A) Routes and components

### Logistics + driver routes
| Route | Purpose | Notes |
|-------|---------|------|
| `/logistics` | Informational landing | Three CTAs: Apply as Driver, Request Delivery, Register Logistics Company. Pay scale table (currently hardcoded). |
| `/logistics/apply` | Single funnel | Two cards: On-Demand Driver → form → POST /api/logistics/apply/on-demand-driver; Provider → /pricing?tab=vendor. |
| `/logistics/request` | Delivery request form | POST /api/deliveries/request. Requires login. |
| `/logistics/dashboard` | Logistics dashboard | Links to routes. |
| `/logistics/routes` | Delivery matching preview | Informational. |
| `/driver/dashboard` | Driver portal | Shows application/driver status; Apply Now / Reapply → /logistics/apply. |
| `/driver-apply` | Redirect only | Client redirect to /logistics/apply. |
| `/admin/drivers` | Admin driver management | Lists driver_applications, drivers, logistics_applications (on_demand_driver). Approve/reject on-demand via RPC. |
| `/admin/logistics` | Admin logistics | Lists logistics_applications; view by id. |

### Components
- **Nav.tsx**: primaryLinks, communityLinks, businessLinksBase (Vendors, Services, Wholesale, Affiliate, Vendor Registration). No "Logistics" or "Driver Network" in Business dropdown.
- **UploadField**: Used for COAs, driver-docs, logistics-docs (bucket/path stored).
- No dedicated `components/logistics` or `components/driver` folders.

---

## B) Data and compliance logic

### Supabase tables
- **drivers** (005, 073, 074): id, user_id (nullable), profile_id, status, application_id, applicant_*, service_radius_miles, is_active. No compliance_status or document URL columns.
- **driver_applications** (005): user_id, full_name, phone, city, state, vehicle_type, status, driver_license_url, insurance_url, mvr_report_url. Used by `/api/drivers/apply` (legacy; /driver-apply now redirects to /logistics/apply).
- **logistics_applications** (073): id, type (provider_listing | on_demand_driver), full_name, email, phone, service_area, vehicle_type, notes, status, reviewed_*. No document columns.
- **delivery_pricing** (073): base_fee_customer, per_mile_customer, minimum_miles, base_pay_driver, per_mile_driver, version. One active row (v1: base_pay 4.00, per_mile 0.60, min 3).
- **deliveries**: vendor_id, driver_id, pickup/dropoff, distance_miles, payout_cents, status.
- **profiles**, **vendors**: existing; no delivery/state columns referenced for checkout.

### Document upload
- **driver_applications**: driver_license_url, insurance_url, mvr_report_url (bucket/path).
- **logistics_applications**: no document fields; on-demand flow is contact form only.
- **UploadField** supports driver-docs, logistics-docs, coas. Signed URLs for private buckets.

### Geo / state
- Checkout create-session accepts vendor_lat/lng, customer_lat/lng, delivery_distance_miles. No customer_state or state-based delivery rule.
- No `hemp_delivery_state_rules` table.

### product.delivery_allowed
- Not present in product fetch in create-session. Delivery is offered per order via delivery_selected and distance.

---

## C) What existed (pre–Phase 7)

- Two paths: (1) On-demand driver via logistics_applications (no docs); (2) Provider → vendor pricing.
- Legacy driver_applications with three doc URLs, used by deprecated /driver-apply flow.
- Pay scale on /logistics hardcoded ($5 base, $1.50/mile) — does not match delivery_pricing (4.00, 0.60).
- No state-based delivery restriction.
- Business dropdown: Vendors, Services, Wholesale, Affiliate, Vendor Registration — no Logistics / Driver Network.

---

## D) What was modified (Phase 7 scope)

- **Nav**: Business dropdown adds Logistics, Driver Network (links to /logistics and /logistics/apply).
- **Checkout**: When delivery_selected and customer_state provided, block if state not in hemp_delivery_state_rules or delivery_allowed = false.
- **Pay scale**: Load from delivery_pricing (active row); display base_pay_driver, per_mile_driver, minimum_miles on /logistics.

---

## E) What was added

- **hemp_delivery_state_rules**: New table (state_code, delivery_allowed, in_person_only, intoxicating_hemp_allowed, citation_url, source_authority, last_verified_at) + seed with state list and citations placeholder.
- **API or server helper**: Resolve delivery state rule by state_code; used by checkout and (optionally) public pay-scale for /logistics.
- **Pay scale API**: Endpoint or server component to return active delivery_pricing for driver pay display (no customer fee or margin).

---

## F) What was preserved

- All existing pages and forms retained.
- /logistics/apply two-card funnel unchanged; on-demand form extended with compliance uploads (additive).
- Admin drivers and logistics flows unchanged except additive compliance review fields.
- No removal of driver_applications or legacy apply route.

---

## G) Compliance models (target)

- **Role 1 — On-Demand Driver**: No MC/DOT. Required: driver_license, mvr, auto_insurance, insurance_declarations, vehicle_registration, background_check_consent, w9. Optional: rideshare_or_delivery_endorsement. Stored: compliance_status, compliance_reviewed_at, compliance_notes (drivers or logistics_applications).
- **Role 2 — Logistics Company**: DOT/MC, commercial_auto_insurance_coi, company_registration_docs, w9. Validate DOT/MC (stub). Enforced after vendor plan purchase.

---

## H) State legality sources (for seed)

- USDA Hemp Program (2018 Farm Bill).
- State departments of agriculture; state alcohol control boards where applicable.
- Per-state statutes for hemp-derived intoxicating product delivery.
- Citation URLs to be filled per state in seed or migration comment.

---

## I) Implemented in this pass (Phase 7 MVP)

- **Nav**: Business dropdown includes Logistics (/logistics) and Driver Network (/logistics/apply).
- **hemp_delivery_state_rules**: Migration 075 adds table + seed for all 50 states + DC; delivery_allowed = false by default (no delivery until state is verified and enabled).
- **Checkout**: When delivery_selected = true, requires body.customer_state (2-letter). If state not in table or delivery_allowed = false, returns 400: "Delivery is not available in your state due to local regulations."
- **Pay scale**: GET /api/logistics/pay-scale returns base_pay_driver, per_mile_driver, minimum_miles from active delivery_pricing. /logistics page fetches and displays; no hardcoded rates.
- **Server**: lib/server/deliveryStateRules.ts — getDeliveryStateRule(stateCode), isDeliveryAllowedInState(stateCode).

## J) Not yet implemented (follow-up)

- On-demand driver compliance uploads (Role 1): add columns to logistics_applications or drivers for document URLs + compliance_status; extend /logistics/apply driver form with UploadField components.
- Logistics company (Role 2): DOT/MC and carrier docs after vendor plan purchase.
- Admin: compliance review UI (view docs, approve/reject with notes, filter by state).
- Per-state citation URLs: update hemp_delivery_state_rules rows with real statute/DoA links and set delivery_allowed = true only where legally verified.
