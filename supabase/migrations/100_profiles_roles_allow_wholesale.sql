-- ============================================================================
-- Allow "wholesale" in profiles.roles (consumer business/wholesale path).
-- Idempotent: drop existing CHECK and re-add with wholesale included.
-- ============================================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_roles_allowed;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_roles_allowed
  CHECK (
    roles <@ ARRAY['consumer','admin','vendor','driver','affiliate','builder','educator','industrial','events','wholesale']::TEXT[]
  );
