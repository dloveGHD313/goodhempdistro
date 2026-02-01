# Admin Product Bulk Moderation and Audit Log — Verification

This document describes how to verify the admin product moderation queue, bulk actions, and audit log.

## Prerequisites

- Admin user (allowlist or profile `is_admin` / `role = 'admin'`).
- Non-admin user for access tests.
- At least one product in `pending_review` and one in `approved` for bulk tests.

---

## 1. Admin queue shows pending_review oldest-first and age displayed

1. Log in as an admin.
2. Go to **Admin → Products** (or `/admin/products`).
3. Click **Product Queue (pending first)** to open `/admin/products/queue`.
4. **Verify:**
   - Only products with status `pending_review` are listed.
   - List is sorted by **oldest `submitted_at` first** (oldest at top).
   - Each row shows: Product name, Vendor, Submitted date, **Age** (days/hours since submitted), Active state.
   - Quick actions per row: View, Approve, Reject, Delete.
5. **View** opens `/admin/products/[id]`. **Approve** / **Reject** / **Delete** behave as single-item actions.

---

## 2. Bulk approve pending_review works and writes audit entries

1. As admin, go to **Product Review** (`/admin/products`) or **Product Queue** (`/admin/products/queue`).
2. Set filter to **Pending** (on list page) or use the queue (already pending-only).
3. Select one or more products via row checkboxes (or **Select all on page**).
4. Click **Approve Selected**.
5. **Verify:**
   - Selected items change to **Approved** (list/queue refreshes).
   - No partial silent failures; invalid statuses are blocked with an explicit message (see below).
6. Go to **Audit Log** (`/admin/audit`).
7. **Verify:** New rows appear with `action = approve`, correct `entity_id` (product id), actor email, timestamp, and status change (e.g. `pending_review → approved`).

---

## 3. Bulk reject requires reason, applies only to pending_review, writes audit entries with reason

1. As admin, select one or more **pending_review** products on list or queue.
2. Click **Reject Selected**.
3. **Verify:** A reason field is required; submitting with &lt; 5 characters is blocked.
4. Enter a reason (e.g. "Needs clearer COA") and confirm.
5. **Verify:**
   - Selected products move to **Rejected**; list/queue refreshes.
   - Only `pending_review` items can be rejected; selecting approved/draft/rejected shows an explicit error (e.g. "N item(s) have invalid status for Reject").
6. Open **Audit Log** (`/admin/audit`).
7. **Verify:** New entries with `action = reject`, correct product id, actor, timestamp, and **reason** populated.

---

## 4. Bulk set active/inactive applies only to approved, writes audit entries

1. As admin, set filter to **Approved** on `/admin/products` (or ensure queue/list shows approved items).
2. Select one or more **approved** products.
3. Click **Set Active** or **Set Inactive**.
4. **Verify:**
   - Active state updates; list refreshes.
   - If any selected item is not `approved`, the action is blocked with an explicit message (e.g. "N item(s) have invalid status for Set Active").
5. Open **Audit Log**.
6. **Verify:** Entries with `action = set_active` or `set_inactive`, correct product id, actor, timestamp.

---

## 5. Bulk delete confirms, deletes, writes audit entries

1. As admin, select one or more products (any status) on list or queue.
2. Click **Delete Selected**.
3. **Verify:** A confirmation step appears (e.g. "Delete N product(s)? This cannot be undone.").
4. Confirm.
5. **Verify:** Products are removed from the list; no partial silent failures for invalid statuses (delete is allowed for draft, pending_review, approved, rejected).
6. Open **Audit Log**.
7. **Verify:** Entries with `action = delete`, correct product id, actor, timestamp (and optional prev_status).

---

## 6. Non-admin cannot access queue, bulk API, or audit page

1. Log out or use an incognito window; log in as a **non-admin** user (no allowlist, no profile admin).
2. **Queue:** Open `/admin/products/queue`.
   - **Expected:** Redirect to `/` or login (no queue content).
3. **Bulk API:** From browser dev tools or Postman, send:
   - `POST /api/admin/products/bulk` with body `{ "action": "approve", "productIds": ["<uuid>"] }` and the non-admin session.
   - **Expected:** `401 Unauthorized` or `403 Forbidden`; no products updated.
4. **Audit page:** Open `/admin/audit`.
   - **Expected:** Redirect to `/` or login; no audit table visible.
5. **Audit API:** `GET /api/admin/audit` as non-admin.
   - **Expected:** `401` or `403`; no audit data returned.

---

## Summary

| Check | Description |
|-------|-------------|
| Queue | `/admin/products/queue` shows only `pending_review`, oldest first, with Age and quick actions. |
| Bulk approve | Works on pending_review; audit entries created. |
| Bulk reject | Reason required (≥5 chars); only pending_review; audit entries include reason. |
| Bulk set active/inactive | Only approved; audit entries created. |
| Bulk delete | Confirmation required; audit entries created. |
| Non-admin | Queue, bulk API, and audit page/API are blocked (redirect or 401/403). |

All moderation actions (single and bulk) must write to `admin_action_logs` and be visible under **Audit Log** with filters: action type, product ID, actor email. Each audit row links to the product detail page (`/admin/products/[id]`) when entity type is product.
