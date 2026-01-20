-- ============================================================================
-- Vendor Security Fix: Strengthen RLS Policies and Add Constraints
-- ============================================================================
-- This migration ensures strict user scoping for vendor_applications and vendors tables

-- ============================================================================
-- 1. Strengthen vendor_applications RLS Policies
-- ============================================================================

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Vendor applications: user can insert/read own" ON vendor_applications;
DROP POLICY IF EXISTS "Vendor applications: admin can read all" ON vendor_applications;
DROP POLICY IF EXISTS "Vendor applications: admin can update all" ON vendor_applications;

-- Separate policies for SELECT, INSERT, UPDATE
-- SELECT: Users can only read their own application
CREATE POLICY "Vendor applications: user can read own" ON vendor_applications
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT: Users can only insert their own application
CREATE POLICY "Vendor applications: user can insert own" ON vendor_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can only update their own application (for edge cases)
CREATE POLICY "Vendor applications: user can update own" ON vendor_applications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Admin policies
CREATE POLICY "Vendor applications: admin can read all" ON vendor_applications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Vendor applications: admin can update all" ON vendor_applications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 2. Strengthen vendors RLS Policies
-- ============================================================================

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Vendors: owner can read own vendor" ON vendors;
DROP POLICY IF EXISTS "Vendors: owner can create own vendor" ON vendors;
DROP POLICY IF EXISTS "Vendors: owner can update own vendor" ON vendors;
DROP POLICY IF EXISTS "Vendors: owner can delete own vendor" ON vendors;

-- Separate policies for each operation
CREATE POLICY "Vendors: owner can read own vendor" ON vendors
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Vendors: owner can create own vendor" ON vendors
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Vendors: owner can update own vendor" ON vendors
  FOR UPDATE USING (auth.uid() = owner_user_id) WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Vendors: owner can delete own vendor" ON vendors
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Admin can read all vendors
CREATE POLICY "Vendors: admin can read all" ON vendors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 3. Ensure Unique Constraints Exist
-- ============================================================================

-- vendor_applications.user_id should already be UNIQUE (from migration 007)
-- But add it if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'vendor_applications_user_id_key'
    AND conrelid = (SELECT oid FROM pg_class WHERE relname = 'vendor_applications')
  ) THEN
    ALTER TABLE vendor_applications ADD CONSTRAINT vendor_applications_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- vendors.owner_user_id should already be UNIQUE (from migration 001)
-- But add it if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'vendors_owner_user_id_key'
    AND conrelid = (SELECT oid FROM pg_class WHERE relname = 'vendors')
  ) THEN
    ALTER TABLE vendors ADD CONSTRAINT vendors_owner_user_id_key UNIQUE (owner_user_id);
  END IF;
END $$;

-- ============================================================================
-- 4. Add Indexes for Performance (if not exist)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vendor_applications_user_id ON vendor_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_owner_user_id ON vendors(owner_user_id);
