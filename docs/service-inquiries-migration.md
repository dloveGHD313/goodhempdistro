# Service Inquiries Migration - Manual Instructions

This guide provides step-by-step instructions for manually applying the Service Inquiries migrations in Supabase Dashboard.

## Prerequisites

- Access to Supabase Dashboard for your project
- SQL Editor permissions
- `services` table must already exist (from earlier migrations)
- `vendors` table must already exist (from earlier migrations)

## Migration Order

Apply these migrations in order:
1. **017_service_inquiries.sql** - Creates the `service_inquiries` table and RLS policies
2. **018_services_rls_fix.sql** - Fixes RLS for services table (if not already applied)

---

## Step 1: Apply Migration 017 - Service Inquiries Table

### Instructions

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and Paste the Migration**
   - Open `supabase/migrations/017_service_inquiries.sql`
   - Copy the entire contents
   - Paste into the SQL Editor

4. **Run the Migration**
   - Click "Run" or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
   - Wait for the query to complete

5. **Verify Success**
   - You should see: "Success. No rows returned"
   - Check for any error messages

6. **Verify Table Created**
   ```sql
   -- Run this in SQL Editor to verify
   SELECT 
     table_name,
     column_name,
     data_type
   FROM information_schema.columns
   WHERE table_name = 'service_inquiries'
   ORDER BY ordinal_position;
   ```
   **Expected:** Should show all columns: `id`, `service_id`, `vendor_id`, `owner_user_id`, `requester_user_id`, `requester_name`, `requester_email`, `requester_phone`, `message`, `status`, `vendor_note`, `created_at`, `updated_at`

7. **Verify RLS Policies**
   ```sql
   -- Check RLS policies
   SELECT 
     policyname,
     cmd,
     qual,
     with_check
   FROM pg_policies
   WHERE tablename = 'service_inquiries';
   ```
   **Expected:** Should show 4 policies:
   - `Service inquiries: public can create for approved active services` (INSERT)
   - `Service inquiries: vendor can read own` (SELECT)
   - `Service inquiries: vendor can update own` (UPDATE)
   - `Service inquiries: admin can manage all` (ALL)

8. **Verify Trigger Function**
   ```sql
   -- Check trigger function exists
   SELECT routine_name, routine_type
   FROM information_schema.routines
   WHERE routine_name = 'prevent_vendor_modify_requester_fields';
   ```
   **Expected:** Should show function exists

---

## Step 2: Apply Migration 018 - Services RLS Fix (If Needed)

**Note:** Only apply this if vendors are unable to create/update services. This migration is idempotent (safe to rerun).

### Instructions

1. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

2. **Copy and Paste the Migration**
   - Open `supabase/migrations/018_services_rls_fix.sql`
   - Copy the entire contents
   - Paste into the SQL Editor

3. **Run the Migration**
   - Click "Run" or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
   - Wait for the query to complete

4. **Verify Success**
   - You should see: "Success. No rows returned"
   - Check for any error messages

5. **Verify Policies**
   ```sql
   -- Check services RLS policies
   SELECT 
     policyname,
     cmd
   FROM pg_policies
   WHERE tablename = 'services'
   AND policyname LIKE '%vendor%';
   ```
   **Expected:** Should show:
   - `Services: vendor can insert own` (INSERT)
   - `Services: vendor can update own` (UPDATE)
   - `Services: vendor can select own` (SELECT)

---

## Troubleshooting

### Error: "relation 'services' does not exist"

**Problem:** The `services` table doesn't exist yet.

**Solution:** 
1. Check if you've run earlier migrations that create the `services` table
2. Look for migrations numbered before 017 (e.g., `016_services_marketplace_complete.sql`)
3. Run those migrations first

### Error: "relation 'vendors' does not exist"

**Problem:** The `vendors` table doesn't exist yet.

**Solution:**
1. Check for vendor-related migrations (e.g., `007_vendor_approval.sql`)
2. Run those migrations first

### Error: "policy already exists"

**Problem:** The migration tries to create a policy that already exists.

**Solution:**
- Migration 017 uses `CREATE POLICY` which will fail if the policy exists
- If you see this error, you can:
  1. Drop the existing policy first:
     ```sql
     DROP POLICY IF EXISTS "Service inquiries: public can create for approved active services" ON service_inquiries;
     ```
  2. Or modify the migration to use `CREATE POLICY IF NOT EXISTS` (PostgreSQL 9.5+)
  3. Or ignore and continue (some policies may already exist)

### Error: "function already exists"

**Problem:** The trigger function already exists.

**Solution:**
- Migration 017 uses `CREATE OR REPLACE FUNCTION`, so this error shouldn't occur
- If it does, the migration should still work (the function will be replaced)

### Error: "column does not exist"

**Problem:** A referenced column is missing.

**Solution:**
1. Verify the `services` table has all required columns:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'services';
   ```
2. Required columns: `id`, `status`, `active`, `vendor_id`, `owner_user_id`
3. If missing, check earlier migrations or add manually

---

## Verification Checklist

After running both migrations, verify everything is working:

### ✅ Table Verification
- [ ] `service_inquiries` table exists
- [ ] All required columns are present
- [ ] Indexes are created (check with `\d service_inquiries` in psql or Table Editor)

### ✅ RLS Verification
- [ ] RLS is enabled on `service_inquiries` table
- [ ] 4 policies exist (public insert, vendor read, vendor update, admin all)
- [ ] Services table has vendor INSERT/UPDATE policies (if migration 018 was run)

### ✅ Trigger Verification
- [ ] `prevent_vendor_modify_requester_fields` function exists
- [ ] `prevent_vendor_modify_requester_fields_trigger` trigger exists
- [ ] `update_service_inquiries_updated_at` trigger exists

### ✅ Functionality Test
- [ ] Try inserting an inquiry (should work for approved services)
- [ ] Try inserting an inquiry for non-approved service (should fail)
- [ ] Login as vendor and try to read own inquiries (should work)
- [ ] Login as vendor and try to update inquiry status (should work)

---

## Complete SQL Verification Query

Run this to verify everything is set up correctly:

```sql
-- Comprehensive verification
SELECT 
  'Tables' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_inquiries')
    THEN '✅ service_inquiries table exists'
    ELSE '❌ service_inquiries table missing'
  END as status
UNION ALL
SELECT 
  'RLS',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename = 'service_inquiries'
      AND rowsecurity = true
    )
    THEN '✅ RLS enabled'
    ELSE '❌ RLS not enabled'
  END
UNION ALL
SELECT 
  'Policies',
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'service_inquiries') = 4
    THEN '✅ All 4 policies exist'
    ELSE '❌ Missing policies (' || (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'service_inquiries') || ' found)'
  END
UNION ALL
SELECT 
  'Function',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'prevent_vendor_modify_requester_fields'
    )
    THEN '✅ Trigger function exists'
    ELSE '❌ Trigger function missing'
  END
UNION ALL
SELECT 
  'Triggers',
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name LIKE '%service_inquiries%') >= 2
    THEN '✅ Triggers exist'
    ELSE '❌ Triggers missing'
  END;
```

**Expected Output:**
```
✅ service_inquiries table exists
✅ RLS enabled
✅ All 4 policies exist
✅ Trigger function exists
✅ Triggers exist
```

---

## Files Reference

- **Migration 017:** `supabase/migrations/017_service_inquiries.sql`
- **Migration 018:** `supabase/migrations/018_services_rls_fix.sql`

---

## Need Help?

If you encounter issues:
1. Check the error message in Supabase SQL Editor
2. Verify all prerequisite tables exist
3. Check Supabase logs for detailed error information
4. Review the troubleshooting section above
