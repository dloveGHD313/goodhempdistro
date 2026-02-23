-- ============================================================================
-- Allow "events" in profiles.roles (align with onboarding VALID_ROLES and lib/roles ALLOWED_ROLES).
-- Safe patch: drop existing CHECK and re-add with events included. No data loss.
-- ============================================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_roles_allowed;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_roles_allowed
  CHECK (
    roles <@ ARRAY['consumer','admin','vendor','driver','affiliate','builder','educator','industrial','events']::TEXT[]
  );
