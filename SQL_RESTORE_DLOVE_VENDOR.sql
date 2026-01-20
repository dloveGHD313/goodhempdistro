-- ============================================================================
-- RESTORE DLove313D@gmail.com AS PENDING VENDOR
-- Safe, minimal SQL - NO schema changes
-- Run in Supabase SQL Editor
-- ============================================================================

-- STEP 1: Find user_id for DLove313D@gmail.com
-- Verification: Should return 1 row with user_id
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
WHERE email = 'DLove313D@gmail.com';

-- STEP 2: Ensure profiles row exists (backfill if missing)
-- Uses auth.users as source of truth
-- DO NOT reference updated_at (column doesn't exist in profiles table)
-- Check which columns exist first, then insert only those
INSERT INTO public.profiles (id, email, role, display_name, created_at)
SELECT 
  au.id,
  au.email,
  'consumer' as role, -- Default role
  COALESCE(au.raw_user_meta_data->>'display_name', NULL) as display_name,
  COALESCE(au.created_at, NOW()) as created_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE au.email = 'DLove313D@gmail.com'
  AND p.id IS NULL -- Only insert if profile doesn't exist
ON CONFLICT (id) DO NOTHING; -- Safe if profile already exists

-- Verification: Check profile was created/exists
SELECT 
  p.id,
  p.email,
  p.role,
  p.display_name,
  p.created_at
FROM public.profiles p
JOIN auth.users au ON au.id = p.id
WHERE au.email = 'DLove313D@gmail.com';

-- STEP 3: Create pending vendor application (only if doesn't exist)
INSERT INTO public.vendor_applications (user_id, business_name, status, created_at)
SELECT 
  au.id as user_id,
  'DLove Test Vendor' as business_name,
  'pending' as status,
  NOW() as created_at
FROM auth.users au
LEFT JOIN public.vendor_applications va ON va.user_id = au.id AND va.status = 'pending'
WHERE au.email = 'DLove313D@gmail.com'
  AND va.id IS NULL -- Only insert if no pending application exists
ON CONFLICT DO NOTHING; -- Safe if application already exists

-- Verification: Check application was created
SELECT 
  va.id,
  va.user_id,
  va.business_name,
  va.status,
  va.created_at,
  au.email as user_email
FROM public.vendor_applications va
JOIN auth.users au ON au.id = va.user_id
WHERE au.email = 'DLove313D@gmail.com'
ORDER BY va.created_at DESC;

-- STEP 4: Final verification - Complete status check
SELECT 
  'Profile' as check_type,
  CASE WHEN p.id IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END as status,
  p.role as role_value
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE au.email = 'DLove313D@gmail.com'
UNION ALL
SELECT 
  'Vendor Application' as check_type,
  CASE WHEN va.id IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END as status,
  va.status as role_value
FROM auth.users au
LEFT JOIN public.vendor_applications va ON va.user_id = au.id AND va.status = 'pending'
WHERE au.email = 'DLove313D@gmail.com'
UNION ALL
SELECT 
  'Vendor Record' as check_type,
  CASE WHEN v.id IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING (expected for pending)' END as status,
  v.status as role_value
FROM auth.users au
LEFT JOIN public.vendors v ON v.owner_user_id = au.id
WHERE au.email = 'DLove313D@gmail.com';

-- ============================================================================
-- EXPECTED RESULTS:
-- 1. Profile: ✅ EXISTS, role='consumer'
-- 2. Vendor Application: ✅ EXISTS, status='pending'
-- 3. Vendor Record: ❌ MISSING (expected - pending vendors don't have vendors row)
-- ============================================================================
