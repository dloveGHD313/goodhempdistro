-- ============================================================================
-- profiles.workout_path: onboarding path from Start flow (shopper/vendor/logistics/builder/affiliate).
-- Separate from profiles.role (account type: consumer/admin). Avoids semantic collision.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS workout_path TEXT;

-- Constraint: NULL or one of the allowed workout path values
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_workout_path_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_workout_path_check
  CHECK (workout_path IS NULL OR workout_path IN ('shopper', 'vendor', 'logistics', 'builder', 'affiliate'));

CREATE INDEX IF NOT EXISTS idx_profiles_workout_path ON public.profiles(workout_path);

COMMENT ON COLUMN public.profiles.workout_path IS 'Start flow selection: where the user said they fit (shopper/vendor/logistics/builder/affiliate). Used for personalized / redirect only. Account type remains in role.';
