-- ============================================================================
-- Backfill Profile Emails from auth.users
-- Ensures all profiles have email populated from auth.users
-- Also creates missing profiles for existing auth.users
-- ============================================================================
-- This migration is idempotent (safe to re-run)

-- Step 1: Insert missing profiles for existing auth.users
-- Only creates profiles that don't exist
INSERT INTO public.profiles (id, email, role, created_at)
SELECT 
  au.id,
  au.email,
  'consumer' as role,
  COALESCE(au.created_at, NOW()) as created_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING; -- Safe if profile already exists

-- Step 2: Backfill null or empty emails from auth.users
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id
AND (p.email IS NULL OR p.email = '');

-- ============================================================================
-- Verification: Check how many profiles were updated
-- ============================================================================
DO $$
DECLARE
  profiles_created INTEGER;
  emails_backfilled INTEGER;
BEGIN
  -- Count profiles that still don't exist (should be 0 after migration)
  SELECT COUNT(*) INTO profiles_created
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE p.id IS NULL;
  
  -- Count profiles with null/empty email (should be 0 after migration)
  SELECT COUNT(*) INTO emails_backfilled
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE (p.email IS NULL OR p.email = '');
  
  IF profiles_created > 0 THEN
    RAISE NOTICE 'Warning: % auth.users still missing profiles', profiles_created;
  ELSE
    RAISE NOTICE 'All auth.users have profiles';
  END IF;
  
  IF emails_backfilled > 0 THEN
    RAISE NOTICE 'Warning: % profiles still have null/empty email', emails_backfilled;
  ELSE
    RAISE NOTICE 'All profiles have email populated';
  END IF;
END $$;
