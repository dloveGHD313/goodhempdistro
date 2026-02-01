# Admin Product Moderation – Verification

## Step-by-step verification

### 1. Admin login → list loads
- Log in as admin (profile role or `ADMIN_EMAILS` / `admin_users` table).
- Open `/admin/products`.
- Confirm the product list loads with summary counts (Total, Pending, Approved, Draft, Rejected).
- Confirm filter tabs: **All**, Pending, Approved, Rejected, Draft.
- Select **All** and confirm products from all statuses appear.

### 2. Filter Pending → open product → approve
- Set filter to **Pending**.
- Click **View / Edit** (or **View / Edit →**) on a pending product.
- Confirm the admin product detail page loads (`/admin/products/[id]`).
- Click **Approve**.
- Confirm success; return to list (or refresh) and confirm the product no longer appears in Pending and appears in Approved (or decrement Pending count).

### 3. Reject flow – reason required and persisted
- From list, pick a **Pending** product and click **Reject**.
- Enter a rejection reason in the textarea and click **Confirm Reject**.
- Confirm the product moves to Rejected and the reason is stored.
- Open a rejected product via **View / Edit** and confirm **Rejection reason** is shown on the detail page.

### 4. Delete product
- From list or detail, click **Delete** (list: confirm with **Yes, delete**).
- Confirm the product is deleted and disappears from the list.
- As the vendor who owned that product, open `/vendors/dashboard/products` and confirm the product is no longer accessible.

### 5. Non-admin access
- Log in as a non-admin user (e.g. vendor or consumer).
- Navigate to `/admin/products`.
- Confirm redirect to login or to home (403), and that the admin product list is not visible.

### 6. Admin product detail actions
- As admin, open `/admin/products/[productId]` for any product.
- Confirm: **Approve** (only when status is Pending), **Reject** (with required reason), **Set Active / Set Inactive** (when Approved), **Edit in vendor form** (link to vendor edit), **Delete** (with confirm).
- Toggle Active on an approved product and confirm the change persists.
- Delete from detail page with confirm and confirm redirect to `/admin/products`.

## Technical notes
- Admin list uses existing `GET /api/admin/products` with `status=all` for the All filter.
- Admin detail loads product via `GET /api/vendors/products/[id]` (cookie forwarded; admin bypass in place).
- Approve: `POST /api/admin/products/[id]/approve`.
- Reject: `POST /api/admin/products/[id]/reject` with `{ reason }`.
- Toggle Active / Delete: `PUT` and `DELETE /api/vendors/products/[id]` (admin can update/delete any product).
- Access control: admin pages use `requireAdmin()`; vendor product API uses admin bypass (`requireAdminUsers` + `isAdminEmail`) for GET/PUT/DELETE.
