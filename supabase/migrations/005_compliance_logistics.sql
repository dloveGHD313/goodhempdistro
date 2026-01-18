-- ============================================================================
-- Compliance + Logistics Migration
-- Good Hemp Distro - COAs, product types, delivery drivers, logistics
-- ============================================================================
-- Run this in Supabase Dashboard → SQL Editor
-- Safe for fresh databases - creates all required tables and columns
-- ============================================================================

-- ============================================================================
-- 1. Add Compliance Fields to Products Table
-- ============================================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS coa_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'non_intoxicating' 
  CHECK (product_type IN ('non_intoxicating', 'intoxicating', 'delta8'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS delta8_disclaimer_ack BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS coa_verified BOOLEAN NOT NULL DEFAULT false;

-- Indexes for compliance fields
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_coa_verified ON products(coa_verified) WHERE coa_verified = true;

-- ============================================================================
-- 2. Add Compliance Attestation Fields to Vendors Table
-- ============================================================================
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS coa_attested BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS coa_attested_at TIMESTAMPTZ;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS intoxicating_policy_ack BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS intoxicating_policy_ack_at TIMESTAMPTZ;

-- Indexes for compliance fields
CREATE INDEX IF NOT EXISTS idx_vendors_coa_attested ON vendors(coa_attested);
CREATE INDEX IF NOT EXISTS idx_vendors_intoxicating_ack ON vendors(intoxicating_policy_ack);

-- ============================================================================
-- 3. Create Driver Applications Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS driver_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_driver_applications_user_id ON driver_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_applications_status ON driver_applications(status);

-- Enable RLS
ALTER TABLE driver_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can insert/read own; admin can read all/update status
DROP POLICY IF EXISTS "Driver applications: user can insert own" ON driver_applications;
DROP POLICY IF EXISTS "Driver applications: user can read own" ON driver_applications;
DROP POLICY IF EXISTS "Driver applications: admin can read all" ON driver_applications;
DROP POLICY IF EXISTS "Driver applications: admin can update" ON driver_applications;

CREATE POLICY "Driver applications: user can insert own" ON driver_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Driver applications: user can read own" ON driver_applications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Driver applications: admin can read all" ON driver_applications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Driver applications: admin can update" ON driver_applications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_driver_applications_updated_at ON driver_applications;
CREATE TRIGGER update_driver_applications_updated_at
  BEFORE UPDATE ON driver_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. Create Drivers Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);

-- Enable RLS
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can read own; admin can manage all
DROP POLICY IF EXISTS "Drivers: user can read own" ON drivers;
DROP POLICY IF EXISTS "Drivers: admin can manage all" ON drivers;

CREATE POLICY "Drivers: user can read own" ON drivers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Drivers: admin can manage all" ON drivers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_drivers_updated_at ON drivers;
CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. Create Deliveries Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  pickup_name TEXT NOT NULL,
  pickup_address TEXT NOT NULL,
  dropoff_name TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  distance_miles NUMERIC(10,2),
  payout_cents INT NOT NULL DEFAULT 0 CHECK (payout_cents >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'picked_up', 'delivered', 'cancelled')),
  bol_url TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deliveries_vendor_id ON deliveries(vendor_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver_id ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

-- Enable RLS
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Vendor owner can create/read own; driver can read assigned; admin can read/update all
DROP POLICY IF EXISTS "Deliveries: vendor can create own" ON deliveries;
DROP POLICY IF EXISTS "Deliveries: vendor can read own" ON deliveries;
DROP POLICY IF EXISTS "Deliveries: driver can read assigned" ON deliveries;
DROP POLICY IF EXISTS "Deliveries: admin can manage all" ON deliveries;

CREATE POLICY "Deliveries: vendor can create own" ON deliveries
  FOR INSERT WITH CHECK (
    vendor_id IN (SELECT id FROM vendors WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "Deliveries: vendor can read own" ON deliveries
  FOR SELECT USING (
    vendor_id IN (SELECT id FROM vendors WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "Deliveries: driver can read assigned" ON deliveries
  FOR SELECT USING (
    driver_id IN (SELECT id FROM drivers WHERE user_id = auth.uid())
  );

CREATE POLICY "Deliveries: admin can manage all" ON deliveries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_deliveries_updated_at ON deliveries;
CREATE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 6. Update Product RLS Policies (add admin update)
-- ============================================================================
DROP POLICY IF EXISTS "Products: admin can update any" ON products;
CREATE POLICY "Products: admin can update any" ON products
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- Summary
-- ============================================================================
-- Tables/Columns created:
--   - products: coa_url, product_type, delta8_disclaimer_ack, coa_verified
--   - vendors: coa_attested, coa_attested_at, intoxicating_policy_ack, intoxicating_policy_ack_at
--   - driver_applications (with RLS)
--   - drivers (with RLS)
--   - deliveries (with RLS)
--
-- RLS Policies:
--   - Products: admin can update any
--   - Driver applications: user insert/read own, admin read/update all
--   - Drivers: user read own, admin manage all
--   - Deliveries: vendor create/read own, driver read assigned, admin manage all
-- ============================================================================
