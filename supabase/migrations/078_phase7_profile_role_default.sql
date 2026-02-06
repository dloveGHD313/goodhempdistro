-- ============================================================================
-- Phase 7: Ensure profile role has default for signup (fix "Database error saving new user")
-- ============================================================================

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'consumer';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    'consumer',
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''), NULLIF(TRIM(NEW.email), '')),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
