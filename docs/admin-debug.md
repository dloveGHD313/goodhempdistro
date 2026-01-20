# Admin & Vendor Debugging Guide

This document provides manual steps to verify and debug admin/vendor flows.

## Prerequisites

- Access to Supabase Dashboard (SQL Editor)
- Admin account with `profiles.role = 'admin'`
- Test accounts: consumer, pending vendor, approved vendor

## 1. Verify Profiles Backfill Worked

### Check for Missing Profiles

```sql
-- Find auth.users without profiles
SELECT 
  au.id,
  au.email,
  au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;
```

**Expected Result:** Should return 0 rows (all users have profiles)

### Verify Auto-Create Trigger

```sql
-- Check if trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

**Expected Result:** Should show trigger on `auth.users` table

### Test Trigger (Optional)

Create a test user in Supabase Auth Dashboard and verify profile is auto-created:

```sql
-- After creating test user, check profile
SELECT * FROM public.profiles WHERE email = 'test@example.com';
```

## 2. Verify Admin Can See Pending Applications

### Check Admin Role

```sql
-- Verify your admin account
SELECT id, email, role FROM public.profiles WHERE role = 'admin';
```

### Check Pending Applications Exist

```sql
-- List all pending applications
SELECT 
  va.id,
  va.user_id,
  va.business_name,
  va.status,
  va.created_at,
  p.email as user_email
FROM vendor_applications va
LEFT JOIN profiles p ON p.id = va.user_id
WHERE va.status = 'pending' OR LOWER(va.status) = 'pending'
ORDER BY va.created_at DESC;
```

**Expected Result:** Should show pending applications (case-insensitive check)

### Check Status Casing

```sql
-- Check for status casing issues
SELECT 
  status,
  COUNT(*) as count
FROM vendor_applications
GROUP BY status;
```

**Expected Result:** Should show consistent casing (preferably lowercase: 'pending', 'approved', 'rejected')

### Verify Admin Page Access

1. Login as admin user
2. Navigate to `/admin/vendors`
3. Check server logs for:
   ```
   [admin/vendors] Admin access attempt: userId=... email=... isAdmin=true
   [admin/vendors] Fetched X total applications: Y pending, Z other statuses
   ```
4. Verify page shows:
   - Total applications count
   - Pending applications count
   - Table of pending applications

## 3. Verify Approval Creates Vendors Row

### Before Approval

```sql
-- Check application exists
SELECT * FROM vendor_applications WHERE id = 'APPLICATION_ID';

-- Verify no vendor row exists yet
SELECT * FROM vendors WHERE owner_user_id = (
  SELECT user_id FROM vendor_applications WHERE id = 'APPLICATION_ID'
);
```

**Expected Result:** Application exists, vendor row should NOT exist

### Approve Application

1. In `/admin/vendors`, click "Approve" on a pending application
2. Check server logs for:
   ```
   [admin/vendors] Approving application ... for user ...
   [admin/vendors] Created vendor record ... for user ...
   [admin/vendors] Updated profile role to 'vendor' for user ...
   ```

### After Approval

```sql
-- Verify vendor row was created
SELECT 
  v.id,
  v.owner_user_id,
  v.business_name,
  v.status,
  va.status as application_status,
  p.email,
  p.role as profile_role
FROM vendors v
JOIN vendor_applications va ON va.user_id = v.owner_user_id
JOIN profiles p ON p.id = v.owner_user_id
WHERE va.id = 'APPLICATION_ID';
```

**Expected Results:**
- `vendors.status` = 'active' (NOT 'pending')
- `vendor_applications.status` = 'approved'
- `profiles.role` = 'vendor'

### Verify Rejection Does NOT Create Vendor

1. Reject an application
2. Verify:
   ```sql
   SELECT * FROM vendors WHERE owner_user_id = 'USER_ID_OF_REJECTED_APP';
   ```
   **Expected Result:** Should return 0 rows (no vendor created on rejection)

## 4. Verify Pending Vendor Can Access Dashboard

### Setup: Create Pending Application

```sql
-- Create test pending application (if needed)
INSERT INTO vendor_applications (user_id, business_name, status)
VALUES (
  'USER_ID',
  'Test Business',
  'pending'
);
```

### Test Dashboard Access

1. Login as user with pending application
2. Navigate to `/vendors/dashboard`
3. **Expected Result:** Should show dashboard with locked/pending UI (NO redirect loop)
4. Check server logs for:
   ```
   [vendors/dashboard] SSR user exists: userId=... email=...
   [authz] VENDOR_CONTEXT_FOUND userId=... applicationFound=true vendorFound=false applicationStatus=pending
   ```

### Verify No Redirect Loop

- User should see pending status card
- User should NOT be redirected to `/vendor-registration`
- User should see locked features (products, storefront, payouts)

## 5. Verify Consumer Redirects Correctly

### Setup: Consumer User (No Vendor Context)

```sql
-- Verify user has no vendor context
SELECT 
  'applications' as source,
  COUNT(*) as count
FROM vendor_applications
WHERE user_id = 'USER_ID'
UNION ALL
SELECT 
  'vendors' as source,
  COUNT(*) as count
FROM vendors
WHERE owner_user_id = 'USER_ID';
```

**Expected Result:** Both counts should be 0

### Test Consumer Access

1. Login as consumer user
2. Navigate to `/vendors/dashboard`
3. **Expected Result:** Should redirect to `/vendor-registration`
4. Check server logs for:
   ```
   [vendors/dashboard] No vendor context found - redirecting to /vendor-registration
   [authz] VENDOR_CONTEXT_MISSING userId=... applicationFound=false vendorFound=false
   ```

## 6. Verify Vendor Registration Page Logic

### Test Cases

#### Case 1: No Context (Consumer)
- Navigate to `/vendor-registration`
- **Expected:** Shows application form

#### Case 2: Pending Application
- Navigate to `/vendor-registration`
- **Expected:** Shows status card with "Go to Vendor Dashboard" button
- Click button → Should navigate to `/vendors/dashboard` (no redirect loop)

#### Case 3: Active Vendor
- Navigate to `/vendor-registration`
- **Expected:** Should redirect to `/vendors/dashboard`

## 7. Check for Data Integrity Issues

### Find Vendors with Wrong Status

```sql
-- Vendors table should only have 'active' status
SELECT 
  id,
  owner_user_id,
  business_name,
  status,
  created_at
FROM vendors
WHERE status != 'active';
```

**Expected Result:** Should return 0 rows (or only 'suspended' if that's valid)

**If found:** These should be cleaned up - vendors table should only represent approved vendors.

### Find Orphaned Vendors (No Application)

```sql
-- Vendors without corresponding application
SELECT 
  v.id,
  v.owner_user_id,
  v.business_name,
  v.status
FROM vendors v
LEFT JOIN vendor_applications va ON va.user_id = v.owner_user_id
WHERE va.id IS NULL;
```

**Expected Result:** Should return 0 rows (all vendors should have applications)

### Find Applications with Wrong User ID

```sql
-- Applications where user_id doesn't match any auth.users
SELECT 
  va.id,
  va.user_id,
  va.business_name,
  va.status
FROM vendor_applications va
LEFT JOIN auth.users au ON au.id = va.user_id
WHERE au.id IS NULL;
```

**Expected Result:** Should return 0 rows

## 8. Common Issues & Fixes

### Issue: Admin Nav Not Showing

**Check:**
```sql
SELECT id, email, role FROM profiles WHERE id = 'YOUR_USER_ID';
```

**Fix:** Ensure `role = 'admin'` (case-sensitive)

### Issue: Pending Applications Not Showing

**Check:**
1. Status casing: `SELECT DISTINCT status FROM vendor_applications;`
2. Service role key is set: `echo $SUPABASE_SERVICE_ROLE_KEY`
3. Server logs for PostgREST errors

**Fix:** Normalize status to lowercase in database

### Issue: Profile Missing After Signup

**Check:**
```sql
SELECT * FROM profiles WHERE id = 'USER_ID';
```

**Fix:** Run backfill migration: `010_backfill_missing_profiles.sql`

### Issue: Vendor Dashboard Redirect Loop

**Check Server Logs:**
- Look for `VENDOR_CONTEXT_MISSING` messages
- Verify `hasContext` is true for pending vendors

**Fix:** Ensure `hasVendorContext()` returns true for pending applications

## 9. Server Log Prefixes

All logs use consistent prefixes for filtering:

- `[admin/vendors]` - Admin vendor management
- `[authz]` - Authorization checks
- `[vendor-registration]` - Vendor registration page
- `[vendors/dashboard]` - Vendor dashboard page

Filter logs: `grep "\[admin/vendors\]" logs.txt`

## 10. Quick Health Check SQL

Run this to get a complete overview:

```sql
-- Complete health check
SELECT 
  'auth_users' as table_name,
  COUNT(*) as total_count
FROM auth.users
UNION ALL
SELECT 
  'profiles' as table_name,
  COUNT(*) as total_count
FROM profiles
UNION ALL
SELECT 
  'vendor_applications' as table_name,
  COUNT(*) as total_count
FROM vendor_applications
UNION ALL
SELECT 
  'vendors' as table_name,
  COUNT(*) as total_count
FROM vendors
UNION ALL
SELECT 
  'pending_applications' as table_name,
  COUNT(*) as total_count
FROM vendor_applications
WHERE LOWER(status) = 'pending'
UNION ALL
SELECT 
  'active_vendors' as table_name,
  COUNT(*) as total_count
FROM vendors
WHERE status = 'active';
```

**Expected:** 
- `auth_users` count = `profiles` count
- `vendors` count <= `vendor_applications` count
- `active_vendors` count = `vendors` count (if no suspended vendors)
