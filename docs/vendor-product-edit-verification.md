# Vendor Product Edit – Verification Plan

## Vendor verification
1. Log in as a vendor who owns an existing product.
2. Go to `/vendors/dashboard/products`.
3. Click **Edit** on a product.
4. Confirm the product loads and the form shows populated values.
5. Save a change and confirm it persists.

## Admin verification
1. Log in as admin.
2. Open a vendor product edit URL: `/vendors/products/[productId]/edit`.
3. Confirm the admin can load, edit, and delete the product.

## Access rules
- **Non-owner, non-admin**: Accessing another vendor’s product edit returns 403 (access denied) or 404 (not found).
- **Product listing**: No regressions on `/vendors/dashboard/products` or `/vendors/products`.

## Technical notes
- Edit page uses `baseUrl` from `x-forwarded-proto`, `x-forwarded-host`, then `NEXT_PUBLIC_SITE_URL`, then `http://localhost:3000`, with cookie forwarded for session.
- API GET uses two-pass select: full columns first; on column/schema error, retry with minimal select and fill optional fields so edit still works when optional columns are missing in DB.
- PUT/DELETE allow admin (admin_users table or ADMIN_EMAILS) to update/delete any product; non-admin must be the vendor owner.
