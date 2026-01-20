# Vendor Ownership Repair Guide

This document provides SQL templates for manually repairing incorrect vendor ownership in the database.

## ⚠️ IMPORTANT WARNINGS

- **DO NOT** run these queries in production without verifying the data first
- **DO NOT** run these queries without understanding the impact
- Always backup your database before making changes
- Test queries in a development/staging environment first
- These queries bypass RLS - only run as a database admin

## Prerequisites

1. Access to Supabase SQL Editor (or direct database access)
2. Admin privileges on the database
3. Understanding of which user_id should own which vendor/application

## Step 1: Identify Ownership Issues

### List all vendors with their owner emails

```sql
SELECT 
  v.id as vendor_id,
  v.owner_user_id,
  v.business_name,
  v.status,
  v.created_at,
  p.email as owner_email,
  p.display_name as owner_name
FROM vendors v
LEFT JOIN profiles p ON p.id = v.owner_user_id
ORDER BY v.created_at DESC;
```

### List all vendor applications with their user emails

```sql
SELECT 
  va.id as application_id,
  va.user_id,
  va.business_name,
  va.status,
  va.created_at,
  p.email as user_email,
  p.display_name as user_name
FROM vendor_applications va
LEFT JOIN profiles p ON p.id = va.user_id
ORDER BY va.created_at DESC;
```

### Find vendors/applications with mismatched ownership

```sql
-- Find vendors where owner_user_id doesn't match any profile
SELECT 
  v.id,
  v.owner_user_id,
  v.business_name,
  'Vendor owner_user_id not found in profiles' as issue
FROM vendors v
LEFT JOIN profiles p ON p.id = v.owner_user_id
WHERE p.id IS NULL;

-- Find applications where user_id doesn't match any profile
SELECT 
  va.id,
  va.user_id,
  va.business_name,
  'Application user_id not found in profiles' as issue
FROM vendor_applications va
LEFT JOIN profiles p ON p.id = va.user_id
WHERE p.id IS NULL;
```

## Step 2: Find Correct User ID by Email

```sql
-- Find user_id for a specific email
SELECT 
  id,
  email,
  display_name,
  role
FROM profiles
WHERE email = 'user@example.com';
```

## Step 3: Repair Vendor Ownership

### Update vendor owner_user_id

```sql
-- Replace 'OLD_USER_ID' with the incorrect owner_user_id
-- Replace 'NEW_USER_ID' with the correct user_id from profiles table
-- Replace 'VENDOR_ID' with the specific vendor id to update

UPDATE vendors
SET 
  owner_user_id = 'NEW_USER_ID',
  updated_at = NOW()
WHERE id = 'VENDOR_ID'
  AND owner_user_id = 'OLD_USER_ID';

-- Verify the update
SELECT 
  v.id,
  v.owner_user_id,
  v.business_name,
  p.email as owner_email
FROM vendors v
LEFT JOIN profiles p ON p.id = v.owner_user_id
WHERE v.id = 'VENDOR_ID';
```

### Example: Fix vendor owned by admin UID

If a vendor is incorrectly owned by admin UID `224b8688-...` and should be owned by user with email `DLove313D@gmail.com`:

```sql
-- 1. Find the correct user_id
SELECT id, email FROM profiles WHERE email = 'DLove313D@gmail.com';

-- 2. Update the vendor (replace with actual IDs from step 1)
UPDATE vendors
SET 
  owner_user_id = (SELECT id FROM profiles WHERE email = 'DLove313D@gmail.com'),
  updated_at = NOW()
WHERE owner_user_id = '224b8688-...'  -- admin UID
  AND business_name = 'Your Business Name';  -- identify the vendor

-- 3. Verify
SELECT 
  v.id,
  v.owner_user_id,
  v.business_name,
  p.email as owner_email
FROM vendors v
LEFT JOIN profiles p ON p.id = v.owner_user_id
WHERE p.email = 'DLove313D@gmail.com';
```

## Step 4: Repair Application Ownership

### Update vendor_application user_id

```sql
-- Replace 'OLD_USER_ID' with the incorrect user_id
-- Replace 'NEW_USER_ID' with the correct user_id from profiles table
-- Replace 'APPLICATION_ID' with the specific application id to update

UPDATE vendor_applications
SET 
  user_id = 'NEW_USER_ID',
  updated_at = NOW()
WHERE id = 'APPLICATION_ID'
  AND user_id = 'OLD_USER_ID';

-- Verify the update
SELECT 
  va.id,
  va.user_id,
  va.business_name,
  va.status,
  p.email as user_email
FROM vendor_applications va
LEFT JOIN profiles p ON p.id = va.user_id
WHERE va.id = 'APPLICATION_ID';
```

## Step 5: Clean Up Duplicate Applications

If a user has multiple applications (should only have one):

```sql
-- Find users with multiple applications
SELECT 
  user_id,
  COUNT(*) as application_count,
  STRING_AGG(id::text, ', ') as application_ids
FROM vendor_applications
GROUP BY user_id
HAVING COUNT(*) > 1;

-- Keep the most recent application, delete others
-- WARNING: This deletes data - verify first!
DELETE FROM vendor_applications
WHERE id IN (
  SELECT id
  FROM vendor_applications
  WHERE user_id = 'USER_ID'
  ORDER BY created_at DESC
  OFFSET 1  -- Keep first (most recent), delete rest
);
```

## Step 6: Verify Repairs

After making changes, verify the repairs:

```sql
-- Check vendor ownership is correct
SELECT 
  v.id as vendor_id,
  v.business_name,
  p.email as owner_email,
  v.status
FROM vendors v
JOIN profiles p ON p.id = v.owner_user_id
WHERE p.email = 'user@example.com';

-- Check application ownership is correct
SELECT 
  va.id as application_id,
  va.business_name,
  p.email as user_email,
  va.status
FROM vendor_applications va
JOIN profiles p ON p.id = va.user_id
WHERE p.email = 'user@example.com';

-- Verify no orphaned records
SELECT COUNT(*) as orphaned_vendors
FROM vendors v
LEFT JOIN profiles p ON p.id = v.owner_user_id
WHERE p.id IS NULL;

SELECT COUNT(*) as orphaned_applications
FROM vendor_applications va
LEFT JOIN profiles p ON p.id = va.user_id
WHERE p.id IS NULL;
```

## Common Scenarios

### Scenario 1: Vendor owned by admin instead of user

**Symptom:** Vendor row has `owner_user_id` = admin UID instead of user UID

**Fix:**
```sql
-- Find the correct user_id
SELECT id, email FROM profiles WHERE email = 'user@example.com';

-- Update vendor
UPDATE vendors
SET owner_user_id = 'CORRECT_USER_ID'
WHERE owner_user_id = 'ADMIN_UID'
  AND business_name = 'Business Name';
```

### Scenario 2: Application has wrong user_id

**Symptom:** Application row has `user_id` that doesn't match the logged-in user

**Fix:**
```sql
-- Find the correct user_id
SELECT id, email FROM profiles WHERE email = 'user@example.com';

-- Update application
UPDATE vendor_applications
SET user_id = 'CORRECT_USER_ID'
WHERE id = 'APPLICATION_ID';
```

### Scenario 3: User has no vendor context but should

**Symptom:** User has no rows in `vendor_applications` or `vendors` but should

**Fix:**
```sql
-- First, check if they should have an application or vendor
-- Then create the missing record with correct user_id

-- Create missing application (if needed)
INSERT INTO vendor_applications (user_id, business_name, status)
VALUES (
  (SELECT id FROM profiles WHERE email = 'user@example.com'),
  'Business Name',
  'pending'
);

-- OR create missing vendor (if approved)
INSERT INTO vendors (owner_user_id, business_name, status)
VALUES (
  (SELECT id FROM profiles WHERE email = 'user@example.com'),
  'Business Name',
  'active'
);
```

## Prevention

To prevent ownership issues:

1. **Always use authenticated user.id** in API routes - never accept user_id from client
2. **Verify ownership** before creating/updating vendor records
3. **Use RLS policies** to enforce ownership at database level
4. **Log ownership mismatches** for monitoring
5. **Run periodic audits** using the queries in Step 1

## Notes

- All timestamps are updated automatically via triggers
- RLS policies will enforce ownership after repair
- Changes take effect immediately (no cache invalidation needed for database)
- Next.js pages may need a hard refresh to see changes
