# Restore DLove313D@gmail.com as Pending Vendor

## Overview
This guide restores DLove313D@gmail.com as a valid pending vendor and verifies all routing behavior.

## SQL to Run (In Order)

**File:** `SQL_RESTORE_DLOVE_VENDOR.sql`

Run the entire file in Supabase SQL Editor. It includes:
1. User lookup verification
2. Profile creation (if missing)
3. Pending vendor application creation (if missing)
4. Complete verification queries

**Expected Results:**
- ✅ Profile exists with `role='consumer'`
- ✅ Vendor application exists with `status='pending'`
- ❌ Vendor record missing (expected - pending vendors don't have vendors row)

## Code Verification Status

### ✅ A) Database SQL
- **File:** `SQL_RESTORE_DLOVE_VENDOR.sql`
- **Status:** Ready to run
- **Safety:** Idempotent (safe to run multiple times)
- **Schema Changes:** NONE (does not reference `updated_at`)

### ✅ B) Frontend/API Verification

#### 1. `app/admin/vendors/page.tsx`
- ✅ Uses `getSupabaseAdminClient()` (service role)
- ✅ Case-insensitive status filtering: `app.status.toLowerCase() === 'pending'`
- ✅ Applications NOT filtered by `user_id` (shows ALL applications)
- ✅ Logs total + pending counts: `[admin/vendors] Fetched X total applications: Y pending`
- ✅ `noStore()` and `revalidate = 0` implemented

#### 2. `components/Nav.tsx`
- ✅ Admin button links to `/admin/vendors` (line 81)
- ✅ Visible when `profiles.role === 'admin'` (line 79)
- ✅ Handles missing profiles gracefully (lines 37-40)
- ✅ Both desktop and mobile show admin links

#### 3. `lib/authz.ts` - `hasVendorContext()`
- ✅ ONLY checks:
  - `vendor_applications.user_id === userId` (line 181)
  - `vendors.owner_user_id === userId` (line 196)
- ✅ Does NOT depend on profiles existing
- ✅ Returns: `hasContext`, `applicationStatus`, `vendorStatus`, `hasVendor`, `_debug`
- ✅ Proper error handling and logging

### ✅ C) Routing Verification

#### Consumer (No Application)
- **Route:** `/vendors/dashboard`
- **Expected:** Redirects to `/vendor-registration`
- **Code:** `app/vendors/dashboard/page.tsx` line 124
- **Verification:** `hasContext === false` triggers redirect

#### Pending Vendor
- **Route:** `/vendor-registration`
- **Expected:** Shows pending status card with "Go to Vendor Dashboard" button
- **Code:** `app/vendor-registration/page.tsx` lines 162-175
- **Route:** `/vendors/dashboard`
- **Expected:** Shows locked dashboard (NO redirect loop)
- **Code:** `app/vendors/dashboard/page.tsx` lines 119-125
- **Verification:** `hasContext === true` (from application) allows access

#### Admin
- **Route:** `/admin/vendors`
- **Expected:** Lists ALL applications (not filtered by user_id)
- **Code:** `app/admin/vendors/page.tsx` line 19-22
- **Verification:** Service role client bypasses RLS

## Manual Steps

### Step 1: Run SQL
1. Open Supabase Dashboard → SQL Editor
2. Copy entire contents of `SQL_RESTORE_DLOVE_VENDOR.sql`
3. Paste and run
4. Verify all 3 checks show expected results

### Step 2: Test as DLove313D@gmail.com
1. Login as DLove313D@gmail.com
2. Navigate to `/vendor-registration`
   - **Expected:** Pending status card with "Go to Vendor Dashboard" button
3. Click "Go to Vendor Dashboard" or navigate to `/vendors/dashboard`
   - **Expected:** Locked dashboard showing pending status (NO redirect loop)
4. Check server logs for:
   ```
   [authz] VENDOR_CONTEXT_FOUND userId=... applicationFound=true vendorFound=false applicationStatus=pending
   ```

### Step 3: Test as Admin
1. Login as admin user
2. Navigate to `/admin/vendors`
   - **Expected:** See "DLove Test Vendor" in pending applications list
3. Verify counts show:
   - Total Applications: >= 1
   - Pending Review: >= 1
4. Check server logs for:
   ```
   [admin/vendors] Admin ... viewing applications: total=X pending=Y
   ```

### Step 4: Test as Consumer
1. Login as consumer (no vendor application)
2. Navigate to `/vendors/dashboard`
   - **Expected:** Redirects to `/vendor-registration`
3. Navigate to `/vendor-registration`
   - **Expected:** Shows application form
4. Check server logs for:
   ```
   [authz] VENDOR_CONTEXT_MISSING userId=... applicationFound=false vendorFound=false
   ```

## Troubleshooting

### Issue: Profile not created
**Check:**
```sql
SELECT * FROM profiles WHERE email = 'DLove313D@gmail.com';
```
**Fix:** Run Step 2 of SQL script again (idempotent)

### Issue: Application not visible to admin
**Check:**
1. Verify application exists:
   ```sql
   SELECT * FROM vendor_applications WHERE business_name = 'DLove Test Vendor';
   ```
2. Check status casing:
   ```sql
   SELECT status, COUNT(*) FROM vendor_applications GROUP BY status;
   ```
3. Check server logs for PostgREST errors

### Issue: Redirect loop for pending vendor
**Check server logs:**
- Look for `VENDOR_CONTEXT_MISSING` (should NOT appear for pending vendor)
- Verify `hasContext === true` in logs

**Fix:** Ensure `hasVendorContext()` returns true when application exists

## Files Changed
- ✅ `SQL_RESTORE_DLOVE_VENDOR.sql` (NEW) - SQL script to restore vendor
- ✅ `docs/RESTORE_DLOVE_VENDOR.md` (NEW) - This guide

## No Code Changes Required
All frontend/API code is already correct:
- ✅ Admin vendors page uses service role correctly
- ✅ Case-insensitive status filtering implemented
- ✅ `hasVendorContext()` doesn't depend on profiles
- ✅ Routing logic handles pending vendors correctly
- ✅ Admin nav links correctly

## Next Steps After SQL Execution
1. ✅ Test as DLove313D@gmail.com (pending vendor)
2. ✅ Test as admin (verify application visible)
3. ✅ Test as consumer (verify redirect works)
4. ✅ Monitor server logs for any issues
