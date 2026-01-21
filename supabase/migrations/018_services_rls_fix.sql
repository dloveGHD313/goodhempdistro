-- ============================================================================
-- Services RLS Fix for Vendor Inserts/Updates
-- Ensures authenticated vendors can insert/update their own services
-- ============================================================================

-- Ensure RLS is enabled (safe to rerun)
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Idempotent cleanup: drop any existing vendor-related policies by name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'services'
      AND policyname = 'Services: vendor owner can manage'
  ) THEN
    DROP POLICY "Services: vendor owner can manage" ON services;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'services'
      AND policyname = 'Services: vendor can insert own'
  ) THEN
    DROP POLICY "Services: vendor can insert own" ON services;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'services'
      AND policyname = 'Services: vendor can update own'
  ) THEN
    DROP POLICY "Services: vendor can update own" ON services;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'services'
      AND policyname = 'Services: vendor can select own'
  ) THEN
    DROP POLICY "Services: vendor can select own" ON services;
  END IF;
END $$;

-- Vendor can INSERT services they own (owner_user_id = auth.uid())
CREATE POLICY "Services: vendor can insert own" ON services
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

-- Vendor can UPDATE services they own
CREATE POLICY "Services: vendor can update own" ON services
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Optional: Vendor can SELECT their own services
CREATE POLICY "Services: vendor can select own" ON services
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_user_id);

-- Note: Public SELECT and Admin policies are already defined in earlier migrations.
-- This migration is now fully idempotent and safe to rerun.
-- ============================================================================
