-- ============================================================================
-- Vendor Tiers + Product Lifecycle + Services Migration
-- Good Hemp Distro - Add vendor tiers/types, product review workflow, services
-- ============================================================================

-- ============================================================================
-- 1. Extend Vendors Table - Add Tier and Vendor Types
-- ============================================================================

-- Add tier column (starter, mid, top)
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'starter' 
  CHECK (tier IN ('starter', 'mid', 'top'));

-- Add vendor_type (single, for starter/mid tiers)
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_type TEXT;

-- Add vendor_types (array, for top tier - can have multiple)
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_types TEXT[];

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendors_tier ON vendors(tier);
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_type ON vendors(vendor_type);

-- ============================================================================
-- 2. Extend Products Table - Add Lifecycle and Review Fields
-- ============================================================================

-- Add status lifecycle field (draft, pending_review, approved, rejected)
ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected'));

-- Add owner_user_id (for direct vendor access without joining through vendors table)
ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add review metadata
ALTER TABLE products ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add subcategory_id for explicit subcategory reference (if needed)
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Update active column: only approved products can be active
-- Note: We'll keep active for backward compatibility but enforce via trigger
ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT false;

-- COA storage path (instead of just URL for signed URLs later)
ALTER TABLE products ADD COLUMN IF NOT EXISTS coa_storage_path TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS coa_uploaded_at TIMESTAMPTZ;

-- Indexes for lifecycle
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_owner_user_id ON products(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_products_submitted_at ON products(submitted_at) WHERE submitted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_reviewed_at ON products(reviewed_at) WHERE reviewed_at IS NOT NULL;

-- Composite index for admin review queue
CREATE INDEX IF NOT EXISTS idx_products_status_submitted ON products(status, submitted_at) 
  WHERE status = 'pending_review';

-- ============================================================================
-- 3. Create Services Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_services_vendor_id ON services(vendor_id);
CREATE INDEX IF NOT EXISTS idx_services_owner_user_id ON services(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_services_category_id ON services(category_id);

-- Enable RLS
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Drop existing services policies if any (idempotency)
DROP POLICY IF EXISTS "Services: public can read approved active" ON services;
DROP POLICY IF EXISTS "Services: vendor owner can manage" ON services;
DROP POLICY IF EXISTS "Services: admin can manage all" ON services;

-- RLS Policies for services (same pattern as products)
-- Public can read approved + active services
CREATE POLICY "Services: public can read approved active" ON services
  FOR SELECT USING (status = 'approved' AND active = true);

-- Vendor owners can CRUD their own services
CREATE POLICY "Services: vendor owner can manage" ON services
  FOR ALL USING (auth.uid() = owner_user_id);

-- Admins can read/update all services
CREATE POLICY "Services: admin can manage all" ON services
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_services_updated_at ON services;
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. Update Products RLS Policies
-- ============================================================================

-- Universal policy cleanup: Drop ALL existing policies for products
-- (Services policies are also dropped in section 3 before creation for safety)
-- This ensures idempotency and prevents policy collision errors
DO $$
DECLARE
  p record;
BEGIN
  -- Drop all policies for products table
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'products'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      p.policyname,
      p.schemaname,
      p.tablename
    );
    RAISE NOTICE 'Dropped policy: % on %.%', p.policyname, p.schemaname, p.tablename;
  END LOOP;

  -- Services policies are dropped explicitly in section 3 before creation
  -- This is here as a safety net but shouldn't be needed
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'services'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      p.policyname,
      p.schemaname,
      p.tablename
    );
    RAISE NOTICE 'Dropped policy: % on %.%', p.policyname, p.schemaname, p.tablename;
  END LOOP;
END $$;

-- Public can read approved + active products only
CREATE POLICY "Products: public can read approved active" ON products
  FOR SELECT USING (status = 'approved' AND active = true);

-- Vendor owners can CRUD their own products (any status except changing to approved directly)
-- Uses owner_user_id for direct access (set by migration)
CREATE POLICY "Products: vendor owner can manage" ON products
  FOR ALL USING (auth.uid() = owner_user_id);

-- Admins can read/update all products
CREATE POLICY "Products: admin can manage all" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 5. Add Trigger to Prevent Vendors from Setting Status to Approved
-- ============================================================================

-- Function to prevent vendors from setting status to approved
CREATE OR REPLACE FUNCTION prevent_vendor_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- If trying to set status to 'approved', check if user is admin
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Only admins can approve products';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS prevent_vendor_product_approval ON products;
CREATE TRIGGER prevent_vendor_product_approval
  BEFORE UPDATE ON products
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION prevent_vendor_approval();

-- Same trigger for services
DROP TRIGGER IF EXISTS prevent_vendor_service_approval ON services;
CREATE TRIGGER prevent_vendor_service_approval
  BEFORE UPDATE ON services
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION prevent_vendor_approval();

-- ============================================================================
-- 6. Backfill owner_user_id for Existing Products
-- ============================================================================

-- Update existing products to have owner_user_id from vendor relationship
UPDATE products p
SET owner_user_id = v.owner_user_id
FROM vendors v
WHERE p.vendor_id = v.id
AND p.owner_user_id IS NULL;

-- ============================================================================
-- 7. Update Existing Products to Draft Status (if they were created before lifecycle)
-- ============================================================================

-- Set existing products without explicit status to 'draft' if they're not already active/visible
-- This is safe - vendors can resubmit after this migration
UPDATE products
SET status = 'draft'
WHERE status IS NULL OR status = '';

-- ============================================================================
-- Summary
-- ============================================================================
-- Added to vendors:
--   - tier (starter/mid/top)
--   - vendor_type (single type)
--   - vendor_types[] (multiple types for top tier)
--
-- Added to products:
--   - status (draft/pending_review/approved/rejected)
--   - owner_user_id (direct vendor user reference)
--   - submitted_at, reviewed_at, reviewed_by, rejection_reason
--   - subcategory_id (explicit subcategory)
--   - coa_storage_path, coa_uploaded_at
--
-- Created services table:
--   - Same lifecycle as products
--   - category_id/subcategory_id references
--   - RLS policies matching products pattern
--
-- RLS Updates:
--   - Public can only see approved + active products/services
--   - Vendors can manage their own (but cannot approve)
--   - Admins can manage all
--
-- Triggers:
--   - Prevent vendors from setting status to approved (DB-level enforcement)
--   - Updated_at triggers for services
-- ============================================================================