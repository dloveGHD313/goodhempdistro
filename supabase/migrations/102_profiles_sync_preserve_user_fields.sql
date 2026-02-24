-- ============================================================================
-- Preserve user-customized display_name and username: only set from auth when
-- existing value is NULL or empty. Email remains auth-authoritative.
-- Replaces handle_auth_user_profile_sync from 101 with same triggers.
-- ============================================================================

SET search_path = public;

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
  p_email_prefix TEXT;
BEGIN
  p_email := COALESCE(TRIM(NEW.email), '');
  p_display_name := TRIM(COALESCE(NEW.raw_user_meta_data->>'display_name', ''));
  IF p_display_name = '' AND p_email <> '' THEN
    p_display_name := COALESCE(SPLIT_PART(p_email, '@', 1), p_email);
  END IF;
  p_username := TRIM(COALESCE(NEW.raw_user_meta_data->>'username', ''));
  IF p_username = '' AND p_email <> '' THEN
    p_email_prefix := regexp_replace(SPLIT_PART(p_email, '@', 1), '[^a-zA-Z0-9_.-]', '_', 'g');
    p_username := LEFT(p_email_prefix, 64);
  END IF;

  INSERT INTO public.profiles (id, email, display_name, username, role, market_mode_preference, created_at, updated_at)
  VALUES (
    NEW.id,
    NULLIF(p_email, ''),
    NULLIF(p_display_name, ''),
    NULLIF(p_username, ''),
    'consumer',
    'CBD_WELLNESS',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    -- Email is auth-authoritative: always update from auth when non-empty
    email = COALESCE(NULLIF(TRIM(EXCLUDED.email), ''), public.profiles.email),
    -- display_name/username: only set when existing is NULL or empty (preserve user-customized)
    display_name = CASE
      WHEN public.profiles.display_name IS NULL OR TRIM(COALESCE(public.profiles.display_name, '')) = ''
      THEN COALESCE(NULLIF(TRIM(EXCLUDED.display_name), ''), public.profiles.display_name)
      ELSE public.profiles.display_name
    END,
    username = CASE
      WHEN public.profiles.username IS NULL OR TRIM(COALESCE(public.profiles.username, '')) = ''
      THEN COALESCE(NULLIF(TRIM(EXCLUDED.username), ''), public.profiles.username)
      ELSE public.profiles.username
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Triggers unchanged (101 already created them); function replacement is enough.
