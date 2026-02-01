# QA — Products Edit Parity (Phase 1)

Vendor product edit flow matches services: no false login redirects, delete button, approval banner, status-aware UI.

## Requirements

- **Auth:** API uses `getSession()` (not `getUser()`) for GET/PUT/DELETE.
- **Data load:** `app/vendors/products/[id]/edit/page.tsx` (server) loads product via GET `/api/vendors/products/[id]` with forwarded cookies (base URL from `x-forwarded-proto` + `x-forwarded-host` or `NEXT_PUBLIC_SITE_URL`).
- **Delete:** Edit form has a "Delete product" button; confirm step ("Yes, delete" / "Cancel"); on success redirect to `/vendors/products`.
- **Approval banner:** When product `status === 'approved'`, show banner: "This product is approved. Changes may require re-approval."
- **Status transitions:** Same lifecycle as services (draft → pending_review → approved/rejected); edit allowed for draft/rejected; approved editable with re-approval note.

## Manual verification

1. **Edit without false redirect**
   - Log in as a vendor with at least one product.
   - Go to `/vendors/dashboard/products` or `/vendors/products`, click Edit on a product.
   - URL should be `/vendors/products/[id]/edit`; page loads product (no redirect to login if session is valid).
   - If not logged in, expect redirect to `/login?redirect=...`.

2. **Approval banner**
   - Edit a product that is **approved** (or set status in DB to `approved` for testing).
   - Open edit page; banner "This product is approved. Changes may require re-approval." appears above the form.

3. **Delete**
   - On edit page, click "Delete product".
   - Confirm step appears ("Delete this product?" with "Yes, delete" and "Cancel").
   - Click "Yes, delete"; product is deleted and browser redirects to `/vendors/products`.
   - Cancel returns to form without deleting.

4. **Save**
   - Change name/price and click "Save Product"; success redirects to `/vendors/dashboard` (unchanged behavior).

5. **API auth**
   - GET/PUT/DELETE `/api/vendors/products/[id]` must use `getSession()`; unauthenticated requests return 401.

## Build

After Phase 1: `npm run build` must pass.
