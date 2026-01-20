-- ============================================================================
-- Backfill missing profiles for existing auth.users
-- Creates public.profiles rows for any auth.users that don't have one
-- ============================================================================
-- This migration is safe to run multiple times (idempotent)

-- Insert missing profiles from auth.users
INSERT INTO public.profiles (id, email, role, display_name, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  'consumer' as role, -- Default role (matches existing schema)
  COALESCE(au.raw_user_meta_data->>'display_name', NULL) as display_name,
  COALESCE(au.created_at, NOW()) as created_at,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING; -- Safe if profile already exists

-- Log how many profiles were created (this will show in migration output)
DO $$
DECLARE
  profiles_created INTEGER;
BEGIN
  SELECT COUNT(*) INTO profiles_created
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  WHERE p.id IS NULL;
  
  IF profiles_created > 0 THEN
    RAISE NOTICE 'Backfilled % missing profile(s)', profiles_created;
  ELSE
    RAISE NOTICE 'All auth.users already have profiles - no backfill needed';
  END IF;
END $$;
