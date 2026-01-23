-- ============================================================================
-- Consumer onboarding profile fields
-- Adds fields for individual/business onboarding and progress tracking
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consumer_type TEXT
  CHECK (consumer_type IN ('individual', 'business'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_type TEXT
  CHECK (business_type IN ('hotel', 'apartment', 'spa', 'office', 'retail', 'event', 'other'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS purchase_intent TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests TEXT[];

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS experience_level TEXT
  CHECK (experience_level IN ('new', 'experienced'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_size TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consumer_onboarding_step INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consumer_onboarding_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consumer_onboarding_completed_at TIMESTAMPTZ;

-- ============================================================================
-- Note: RLS policies remain unchanged (users can update own profile).
-- ============================================================================
