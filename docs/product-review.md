# Product Review Workflow Documentation

## Overview

Products in Good Hemp Distro follow a review workflow where vendors create draft products, submit them for admin review, and only approved products are visible to the public.

## Lifecycle States

1. **draft** - Initial state when vendor creates a product. Not visible to public.
2. **pending_review** - Vendor has submitted product for admin review. Not visible to public.
3. **approved** - Admin has approved the product. Can be made active and visible to public.
4. **rejected** - Admin has rejected the product. Vendor can see rejection reason and edit/resubmit.

## Database Schema

### Products Table
- `status` - lifecycle state (draft/pending_review/approved/rejected)
- `owner_user_id` - direct reference to vendor user (for RLS)
- `submitted_at` - timestamp when vendor submitted for review
- `reviewed_at` - timestamp when admin reviewed
- `reviewed_by` - admin user ID who reviewed
- `rejection_reason` - text reason if rejected
- `active` - boolean, only approved products can be active

### Vendors Table (Extended)
- `tier` - starter/mid/top (affects vendor type selection)
- `vendor_type` - single type for starter/mid tiers
- `vendor_types[]` - array of types for top tier

## Vendor Flow

### 1. Create Product
- POST `/api/vendors/products/create`
- Status defaults to `draft`
- `owner_user_id` set automatically from authenticated user
- Product is not visible to public

### 2. Submit for Review
- POST `/api/vendors/products/[id]/submit`
- Validates COA requirement if category requires it
- Updates status to `pending_review`
- Sets `submitted_at` timestamp
- Product appears in admin review queue

### 3. View Products
- GET `/vendors/products`
- Shows all products grouped by status (draft, pending, approved, rejected)
- Shows rejection reason if rejected
- Can edit draft or rejected products

## Admin Flow

### 1. Review Queue
- GET `/admin/products`
- Lists all products with `status = 'pending_review'`
- Shows vendor info, COA link, submitted date

### 2. Approve Product
- POST `/api/admin/products/[id]/approve`
- Sets status to `approved`
- Sets `active = true` (auto-activates)
- Sets `reviewed_at` and `reviewed_by`
- Product becomes visible on public listings

### 3. Reject Product
- POST `/api/admin/products/[id]/reject`
- Requires `reason` in request body
- Sets status to `rejected`
- Sets `active = false`
- Sets `reviewed_at`, `reviewed_by`, and `rejection_reason`
- Vendor can see reason and resubmit after editing

## Vendor Tier & Type Rules

### Starter/Mid Tier
- Must select exactly ONE `vendor_type`
- Cannot use `vendor_types[]` array
- Enforced server-side in `/api/vendor/profile`

### Top Tier
- Can select MULTIPLE vendor types in `vendor_types[]` array
- Cannot use single `vendor_type`
- Enforced server-side in `/api/vendor/profile`

### Settings Page
- `/vendors/settings`
- Vendor can update tier and vendor types
- UI enforces rules based on selected tier

## RLS Policies

### Products
- **Public Read**: Only `status = 'approved' AND active = true`
- **Vendor CRUD**: Can manage own products where `owner_user_id = auth.uid()`
- **Vendor Restriction**: Cannot set status to `approved` (trigger prevents this)
- **Admin**: Can read/update all products

### Services
- Same pattern as products
- Public can only see approved + active services

## SQL Verification Queries

### Check Product Statuses
```sql
SELECT 
  status,
  COUNT(*) as count
FROM products
GROUP BY status
ORDER BY status;
```

### List Pending Products
```sql
SELECT 
  p.id,
  p.name,
  p.status,
  p.submitted_at,
  v.business_name,
  p.owner_user_id
FROM products p
LEFT JOIN vendors v ON v.id = p.vendor_id
WHERE p.status = 'pending_review'
ORDER BY p.submitted_at ASC;
```

### List Products by Vendor
```sql
SELECT 
  p.id,
  p.name,
  p.status,
  p.active,
  p.submitted_at,
  p.reviewed_at,
  p.rejection_reason
FROM products p
WHERE p.owner_user_id = 'USER_ID_HERE'
ORDER BY p.created_at DESC;
```

### Verify Vendor Ownership
```sql
SELECT 
  p.id,
  p.name,
  p.owner_user_id,
  v.owner_user_id as vendor_owner_user_id,
  CASE 
    WHEN p.owner_user_id = v.owner_user_id THEN 'MATCH'
    ELSE 'MISMATCH'
  END as ownership_status
FROM products p
LEFT JOIN vendors v ON v.id = p.vendor_id
WHERE p.owner_user_id IS NOT NULL;
```

## Manual Testing Checklist

### Vendor Product Creation
1. ✅ Login as vendor → Navigate to `/vendors/products/new`
2. ✅ Create product → Status should be `draft`
3. ✅ Product appears in `/vendors/products` as draft
4. ✅ Product does NOT appear in public `/products` listing

### Product Submission
1. ✅ Edit draft product → Add COA if required by category
2. ✅ Click "Submit for Review" → Status changes to `pending_review`
3. ✅ Product moves to "Pending" section in vendor products list
4. ✅ Product does NOT appear in public listing yet

### Admin Review
1. ✅ Login as admin → Navigate to `/admin/products`
2. ✅ Pending product appears in review queue
3. ✅ Approve product → Status changes to `approved`, `active = true`
4. ✅ Product now appears in public `/products` listing

### Product Rejection
1. ✅ Admin rejects product with reason → Status changes to `rejected`
2. ✅ Product moves to "Rejected" section in vendor products list
3. ✅ Vendor can see rejection reason
4. ✅ Vendor can edit and resubmit

### COA Requirement
1. ✅ Select category that requires COA (e.g., "Edibles")
2. ✅ Try to submit without COA → Error: "COA is required..."
3. ✅ Upload COA → Submit succeeds
4. ✅ Select category that doesn't require COA (e.g., "Hempcrete")
5. ✅ Submit without COA → Succeeds

### Vendor Tier/Type
1. ✅ Navigate to `/vendors/settings`
2. ✅ Select "Starter" tier → Must choose exactly one vendor type
3. ✅ Select "Top" tier → Can choose multiple vendor types
4. ✅ Save settings → Updates vendor record

### Public Visibility
1. ✅ Only approved + active products appear in `/products`
2. ✅ Draft/pending/rejected products are hidden
3. ✅ After admin approval, product becomes visible immediately

## Common Issues & Solutions

### Issue: "Vendor account not found" on product creation
- **Cause**: Vendor row missing or `owner_user_id` mismatch
- **Solution**: Ensure vendor approval creates vendor row correctly

### Issue: Product not appearing in public listing after approval
- **Cause**: Product not set to `active = true` or status not `approved`
- **Solution**: Verify both status and active fields after approval

### Issue: Cannot submit product without COA
- **Cause**: Category requires COA but none provided
- **Solution**: Upload COA or select different category

### Issue: Rejected product cannot be resubmitted
- **Cause**: Product still has `status = 'rejected'`
- **Solution**: Edit product (which allows status to change) then submit again

## Security Notes

- Vendors cannot approve their own products (DB trigger prevents)
- Only admins can set status to `approved`
- All vendor operations use `owner_user_id` for RLS enforcement
- Service role client only used in admin pages with admin verification
