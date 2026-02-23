-- ============================================================================
-- Profiles sync from auth.users: ensure email, display_name, username populated.
-- Add username column; replace trigger/function to set display_name from meta or email prefix.
-- Backfill existing auth.users into profiles.
-- ============================================================================

SET search_path = public;

-- Add username if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'username'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN username TEXT;
  END IF;
END $$;

-- Ensure email exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
    CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
  END IF;
END $$;

-- Ensure display_name exists (idempotent)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Function: sync profile from auth.users (insert/update). SECURITY DEFINER, set search_path.
CREATE OR REPLACE FUNCTION public.handle_auth_user_profile_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_display_name TEXT;
  p_username TEXT;
  p_email TEXT;
BEGIN
  p_email := COALESCE(NEW.email, '');
  p_display_name := TRIM(COALESCE(NEW.raw_user_meta_data->>'display_name', ''));
  IF p_display_name = '' AND p_email <> '' THEN
    p_display_name := COALESCE(SPLIT_PART(p_email, '@', 1), p_email);
  END IF;
  p_username := TRIM(COALESCE(NEW.raw_user_meta_data->>'username', ''));

  INSERT INTO public.profiles (id, email, display_name, username, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NULLIF(p_email, ''),
    NULLIF(p_display_name, ''),
    NULLIF(p_username, ''),
    'consumer',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(NULLIF(TRIM(EXCLUDED.email), ''), public.profiles.email),
    display_name = COALESCE(NULLIF(TRIM(EXCLUDED.display_name), ''), public.profiles.display_name),
    username = COALESCE(NULLIF(TRIM(EXCLUDED.username), ''), public.profiles.username),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Trigger: after insert on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_profile_sync();

-- Trigger: after update on auth.users (sync email/meta changes)
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email OR OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data)
  EXECUTE FUNCTION public.handle_auth_user_profile_sync();

-- Backfill: upsert existing auth.users into profiles (email, display_name, username)
INSERT INTO public.profiles (id, email, display_name, username, role, created_at, updated_at)
SELECT
  au.id,
  au.email,
  COALESCE(
    NULLIF(TRIM(au.raw_user_meta_data->>'display_name'), ''),
    CASE WHEN au.email <> '' THEN SPLIT_PART(au.email, '@', 1) ELSE NULL END
  ),
  NULLIF(TRIM(au.raw_user_meta_data->>'username'), ''),
  COALESCE(p.role, 'consumer'),
  COALESCE(p.created_at, NOW()),
  NOW()
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
ON CONFLICT (id) DO UPDATE SET
  email = COALESCE(NULLIF(TRIM(EXCLUDED.email), ''), public.profiles.email),
  display_name = COALESCE(NULLIF(TRIM(EXCLUDED.display_name), ''), public.profiles.display_name),
  username = COALESCE(NULLIF(TRIM(EXCLUDED.username), ''), public.profiles.username),
  updated_at = NOW();
