-- ============================================================================
-- Phase 1.5: Post-auth questionnaire storage
-- Stores role-tailored questionnaire answers and completion marker.
-- Separate from consumer_onboarding_* / vendor_onboarding_* (role-specific flows).
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_answers JSONB DEFAULT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;
