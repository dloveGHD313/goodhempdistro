-- ============================================================================
-- Update business_type check constraint for consumer onboarding
-- ============================================================================

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%business_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_business_type_check
    CHECK (
      business_type IN (
        'hotel',
        'apartment',
        'spa',
        'office',
        'retail',
        'event',
        'staff_buyers',
        'b2b',
        'other'
      )
    );
END $$;

-- ============================================================================
-- Note: Allows NULL business_type for individual consumers.
-- ============================================================================
