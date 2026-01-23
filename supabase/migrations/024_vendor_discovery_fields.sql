-- ============================================================================
-- Vendor discovery fields (type, location, tags, active/approved flags)
-- ============================================================================

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_type TEXT
  CHECK (vendor_type IN (
    'farmer',
    'wholesaler',
    'retailer',
    'service_provider',
    'hotel_b2b_supplier',
    'event_host',
    'other'
  ));

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS service_areas TEXT[];
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS categories TEXT[];
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tags TEXT[];

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;

-- Backfill flags from status if needed
UPDATE vendors
SET is_approved = (status = 'active')
WHERE is_approved IS NULL;

UPDATE vendors
SET is_active = (status != 'suspended')
WHERE is_active IS NULL;

-- Indexes for discovery queries
CREATE INDEX IF NOT EXISTS idx_vendors_state ON vendors(state);
CREATE INDEX IF NOT EXISTS idx_vendors_city ON vendors(city);
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_type ON vendors(vendor_type);
CREATE INDEX IF NOT EXISTS idx_vendors_is_active ON vendors(is_active);
CREATE INDEX IF NOT EXISTS idx_vendors_is_approved ON vendors(is_approved);

-- Public discovery policy (approved + active vendors only)
DROP POLICY IF EXISTS "Vendors: public can read approved" ON vendors;
CREATE POLICY "Vendors: public can read approved" ON vendors
  FOR SELECT USING (
    (is_active = true AND is_approved = true) OR status = 'active'
  );

-- ============================================================================
-- Note: Vendor owners still retain owner-only access via existing policies.
-- ============================================================================
