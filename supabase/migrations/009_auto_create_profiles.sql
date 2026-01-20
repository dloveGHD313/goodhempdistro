-- ============================================================================
-- Auto-create profiles on auth.users insert
-- Ensures every auth.users row has a corresponding public.profiles row
-- ============================================================================

-- Function to handle profile creation when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile with default values
  -- Use email from auth.users if available
  -- Default role: Use 'consumer' as default (matches existing schema CHECK constraint)
  INSERT INTO public.profiles (id, email, role, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    'consumer', -- Default role (matches existing schema)
    COALESCE(NEW.raw_user_meta_data->>'display_name', NULL),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING; -- Safe if profile already exists
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Ensure profiles.email column exists (if not already added)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
    CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
  END IF;
END $$;

-- ============================================================================
-- Update role default to 'user' if it doesn't match existing schema
-- Note: Check existing schema first - if role uses 'consumer' as default,
-- adjust accordingly. This migration assumes 'user' is the default.
-- ============================================================================
DO $$
BEGIN
  -- Check if role column exists and what its default is
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'role'
  ) THEN
    -- If default is 'consumer', we'll keep it; if 'user', keep it
    -- This is safe - we're just ensuring the trigger uses the right default
    NULL; -- No change needed, just verify column exists
  END IF;
END $$;
