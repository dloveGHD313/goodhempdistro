# Admin Vendors Page Verification Guide

## Overview
The `/admin/vendors` page uses an RPC function (`admin_list_vendor_applications`) to bypass RLS without requiring a service role key. This guide helps verify the setup and diagnose issues.

## Prerequisites
- Admin user with `profiles.role = 'admin'`
- RPC function `admin_list_vendor_applications` exists in database
- User is authenticated

## SQL Verification

### 1. Confirm Applications Exist

```sql
-- Check total applications in database
SELECT COUNT(*) as total_applications
FROM public.vendor_applications;

-- Check pending applications
SELECT COUNT(*) as pending_applications
FROM public.vendor_applications
WHERE LOWER(status) = 'pending';

-- List all applications with user emails
SELECT 
  va.id,
  va.business_name,
  va.status,
  va.created_at,
  p.email as user_email
FROM public.vendor_applications va
LEFT JOIN public.profiles p ON p.id = va.user_id
ORDER BY va.created_at DESC;
```

**Expected:** Should show applications if any exist.

### 2. Confirm Admin Profile Role

```sql
-- Check your admin profile (replace with your user_id)
SELECT 
  id,
  email,
  role,
  created_at
FROM public.profiles
WHERE email = 'your-admin-email@example.com';

-- Or check by user_id
SELECT 
  id,
  email,
  role
FROM public.profiles
WHERE id = 'your-user-id-here';
```

**Expected:** `role` should be `'admin'` (case-sensitive).

### 3. Verify RPC Function Exists

```sql
-- Check if function exists
SELECT 
  p.proname as function_name,
  pg_get_function_result(p.oid) as return_type,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
AND p.proname = 'admin_list_vendor_applications';
```

**Expected:** Should return 1 row with function definition.

### 4. Test RPC Function (as Admin)

```sql
-- Test RPC function (must be run as authenticated admin user)
-- This will return 0 rows if you're not an admin
SELECT * FROM public.admin_list_vendor_applications();
```

**Expected:** Should return all vendor applications if you're an admin, 0 rows if not.

**Note:** In SQL Editor, `auth.uid()` returns `null`, so this will return 0 rows. This is expected. The function works correctly in the app runtime where `auth.uid()` is set.

## Diagnostics Panel

The `/admin/vendors` page includes a diagnostics panel (click "🔍 Diagnostics" to expand).

### What It Shows

1. **Supabase URL:** The `NEXT_PUBLIC_SUPABASE_URL` value
2. **Project Ref:** Extracted project reference from URL
3. **User ID:** Current authenticated user's ID
4. **User Email:** Current authenticated user's email
5. **Profile Role:** Your profile's role (should be `'admin'`)
6. **Profile Email:** Your profile's email
7. **Total Applications:** Count from RPC
8. **Pending Applications:** Count of pending from RPC
9. **RPC Error:** If RPC call failed, shows error details

### Expected Values

- **Profile Role:** `'admin'` (not `'Admin'` or `'ADMIN'`)
- **Total Applications:** Should match SQL count
- **Pending Applications:** Should match SQL pending count
- **RPC Error:** Should be empty/null

## Common Issues & Fixes

### Issue 1: Total Applications = 0, but SQL shows applications exist

**Possible Causes:**
1. **Wrong Supabase Project**
   - Check `Supabase URL` in diagnostics
   - Verify it matches your production database
   - Check `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`

2. **Admin Role Missing**
   - Check `Profile Role` in diagnostics
   - If not `'admin'`, update:
     ```sql
     UPDATE public.profiles
     SET role = 'admin'
     WHERE id = 'your-user-id';
     ```

3. **Profile Row Missing**
   - Check `Profile Email` in diagnostics
   - If `NOT FOUND`, create profile:
     ```sql
     INSERT INTO public.profiles (id, email, role, created_at)
     SELECT 
       au.id,
       au.email,
       'admin',
       NOW()
     FROM auth.users au
     WHERE au.email = 'your-email@example.com'
     ON CONFLICT (id) DO UPDATE SET role = 'admin';
     ```

4. **RPC Function Missing**
   - Run migration `011_admin_list_vendor_applications_rpc.sql`
   - Verify function exists (see SQL verification above)

### Issue 2: RPC Error in Diagnostics

**Check Error Details:**
- **Code:** PostgREST error code
- **Message:** Human-readable error
- **Details:** Additional context
- **Hint:** Suggested fix

**Common Errors:**
- `PGRST116`: Function not found → Run migration
- `42501`: Permission denied → Check function permissions
- `42883`: Function does not exist → Run migration

### Issue 3: Profile Role Not Admin

**Fix:**
```sql
-- Update your profile to admin
UPDATE public.profiles
SET role = 'admin'
WHERE id = 'your-user-id'
RETURNING id, email, role;
```

**Verify:**
- Refresh `/admin/vendors` page
- Check diagnostics panel
- `Profile Role` should now show `'admin'`

### Issue 4: Wrong Supabase Project

**Symptoms:**
- Applications exist in SQL Editor but page shows 0
- Different project ref in diagnostics vs expected

**Fix:**
1. Check `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   ```
2. Restart Next.js dev server
3. Clear browser cache
4. Verify diagnostics panel shows correct URL

## Manual Testing Checklist

- [ ] Run SQL verification queries (all should pass)
- [ ] Login as admin user
- [ ] Navigate to `/admin/vendors`
- [ ] Expand diagnostics panel
- [ ] Verify `Profile Role` = `'admin'`
- [ ] Verify `Total Applications` matches SQL count
- [ ] Verify `Pending Applications` matches SQL pending count
- [ ] Verify no RPC errors
- [ ] Verify applications table displays correctly
- [ ] Test approve/reject flow (should still work)

## Troubleshooting Steps

1. **Check Diagnostics Panel**
   - Expand diagnostics on `/admin/vendors`
   - Note all values
   - Compare with expected values above

2. **Verify Database State**
   - Run SQL verification queries
   - Compare counts with diagnostics panel

3. **Check Environment Variables**
   - Verify `NEXT_PUBLIC_SUPABASE_URL` is set correctly
   - Check for typos or wrong project URL

4. **Verify RPC Function**
   - Run SQL to check function exists
   - Verify function permissions

5. **Check Admin Role**
   - Verify profile role in database
   - Update if needed (see fixes above)

## Success Criteria

✅ Diagnostics panel shows:
- Profile Role: `'admin'`
- Total Applications: > 0 (if applications exist)
- Pending Applications: >= 0
- No RPC errors

✅ Applications table displays:
- All applications visible
- Pending applications highlighted
- Approve/Reject buttons work

✅ No service role key required:
- Page works without `SUPABASE_SERVICE_ROLE_KEY`
- RPC function handles RLS bypass
