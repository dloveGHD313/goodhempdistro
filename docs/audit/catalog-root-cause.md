# Catalog Root Cause

**Classification: Case A — Truly no approved products in DB (early launch state)**
Combined with: **Case E — UX bug: misleading empty-state message**

---

## Evidence

1. The live audit (2026-03-02) shows 0 product cards rendered at `/products` for all roles.
2. The server-side `getProducts()` returns an empty array; `initialProducts=[]` is passed to `ProductsList`.
3. No filtering or RLS issue — the query succeeds (no error logged), returns `data=[]`.
4. The platform is in early launch: blog is empty, vendor onboarding exists but no vendor has approved listed products yet.
5. Even the `/admin/products` queue would be the place to check for products pending approval (out of scope for this fix).

---

## The UX bug (Case E overlay)

`ProductsList.tsx` renders the same empty state message for two distinct situations:

| Situation | What user sees | What they should see |
|---|---|---|
| **No products in DB at all** (Case A) | "No products match your filters." | "Marketplace coming online…" |
| **Products exist but filtered** (Case B/E) | "No products match your filters." | "No products match your filters." |

The "No products match your filters" message is only truthful in the second case. In the first case, it implies the user did something wrong (adjusted filters incorrectly), when in reality the catalogue is simply empty.

---

## Root cause summary

The catalogue is empty because the platform is in early vendor onboarding — no vendors have completed onboarding and had products approved yet. The data pipeline and query logic are correct. The only fix needed is:

1. **Distinguish empty-catalogue from filter-eliminated** in `ProductsList`
2. **Render a premium "Marketplace Coming Online" state** when `initialProducts.length === 0`
3. **Keep existing "No products match your filters"** when products exist but filters narrowed to zero

---

## What was NOT the cause

- RLS policy: query returned cleanly with no errors
- API logic bug: server component correctly fetches from Supabase
- UI rendering bug: `filteredProducts` is empty because `initialProducts` is empty, not because of a filter mapping error
- Auth/session issue: same result for all roles

---

## Schema constraints observed

- `products.status = "approved"` required for visibility
- `products.active = true` required
- `products.is_gated = false` required for public (non-recreational)
- Products must have `vendor_id` pointing to `vendors.status = "active"` vendor
- For logged-out users: product's category must NOT require COA

All filters are correct per the compliance spec. No filter should be relaxed.
