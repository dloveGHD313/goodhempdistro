-- ============================================================================
-- Add 'education' to profiles.workout_path allowed values (CEO vision: Education Hub).
-- ============================================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_workout_path_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_workout_path_check
  CHECK (workout_path IS NULL OR workout_path IN ('shopper', 'vendor', 'logistics', 'builder', 'affiliate', 'education'));

-- Index already exists from 091; comment update optional
COMMENT ON COLUMN public.profiles.workout_path IS 'Start flow selection: where the user said they fit (shopper/vendor/logistics/builder/affiliate/education). Used for personalized / redirect only. Account type remains in role.';
