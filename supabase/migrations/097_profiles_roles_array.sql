-- ============================================================================
-- Multi-role support: profiles.roles TEXT[] for multiple roles per user.
-- Keeps profiles.role for backward compatibility; RLS can use either.
-- ============================================================================

-- Add roles array; default single-element from existing role semantics
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT ARRAY['consumer']::TEXT[];

-- Backfill from existing role column
UPDATE public.profiles
SET roles = ARRAY[COALESCE(role, 'consumer')]::TEXT[]
WHERE roles IS NULL OR array_length(roles, 1) IS NULL;

-- Ensure non-null default for new rows
ALTER TABLE public.profiles
  ALTER COLUMN roles SET DEFAULT ARRAY['consumer']::TEXT[];

-- Constraint: only allowed role slugs (consumer, admin, vendor, driver, affiliate, builder, educator, industrial)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_roles_allowed'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_roles_allowed
      CHECK (
        roles <@ ARRAY['consumer','admin','vendor','driver','affiliate','builder','educator','industrial']::TEXT[]
      );
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.roles IS 'User roles for tailoring experience; multiple allowed. Backfilled from role + workout_path.';

-- Optional: GIN index for role containment queries (e.g. WHERE 'vendor' = ANY(roles))
CREATE INDEX IF NOT EXISTS idx_profiles_roles_gin
  ON public.profiles USING GIN (roles);
