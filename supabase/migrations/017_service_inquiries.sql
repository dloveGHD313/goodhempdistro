-- ============================================================================
-- Service Inquiries Migration (Corrected Schema)
-- Good Hemp Distro - Service inquiry system with vendor inbox
-- ============================================================================

-- ============================================================================
-- 1. Drop old service_inquiries table if it exists (from migration 016)
-- ============================================================================

DROP TABLE IF EXISTS service_inquiries CASCADE;

-- ============================================================================
-- 2. Create Service Inquiries Table (Corrected Schema)
-- ============================================================================

CREATE TABLE service_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_name TEXT,
  requester_email TEXT,
  requester_phone TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' 
    CHECK (status IN ('new', 'replied', 'closed')),
  vendor_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. Indexes
-- ============================================================================

CREATE INDEX idx_service_inquiries_vendor_id_created ON service_inquiries(vendor_id, created_at DESC);
CREATE INDEX idx_service_inquiries_service_id_created ON service_inquiries(service_id, created_at DESC);
CREATE INDEX idx_service_inquiries_owner_user_id_created ON service_inquiries(owner_user_id, created_at DESC);
CREATE INDEX idx_service_inquiries_status ON service_inquiries(status);

-- ============================================================================
-- 4. Enable RLS
-- ============================================================================

ALTER TABLE service_inquiries ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. RLS Policies
-- ============================================================================

-- Public (anon/auth): can insert inquiry ONLY if the target service is approved AND active=true
-- AND vendor_id/owner_user_id match the service's values (security: do not trust client-supplied values)
CREATE POLICY "Service inquiries: public can create for approved active services" ON service_inquiries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM services 
      WHERE services.id = service_inquiries.service_id 
      AND services.status = 'approved' 
      AND services.active = true
      AND services.vendor_id = service_inquiries.vendor_id
      AND services.owner_user_id = service_inquiries.owner_user_id
    )
  );

-- Vendor (auth): can select inquiries where owner_user_id = auth.uid()
CREATE POLICY "Service inquiries: vendor can read own" ON service_inquiries
  FOR SELECT USING (auth.uid() = owner_user_id);

-- Vendor (auth): can update inquiries where owner_user_id = auth.uid()
-- (Trigger enforces that requester fields cannot be changed)
CREATE POLICY "Service inquiries: vendor can update own" ON service_inquiries
  FOR UPDATE USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Admin: can read/update all (use existing admin role pattern)
CREATE POLICY "Service inquiries: admin can manage all" ON service_inquiries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- ============================================================================
-- 6. Function to Prevent Vendor from Modifying Requester Fields
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_vendor_modify_requester_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- If user is not admin, prevent changes to requester fields
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ) THEN
    -- Vendors can only update status and vendor_note
    -- Ensure requester fields are unchanged
    IF OLD.requester_user_id IS DISTINCT FROM NEW.requester_user_id OR
       OLD.requester_name IS DISTINCT FROM NEW.requester_name OR
       OLD.requester_email IS DISTINCT FROM NEW.requester_email OR
       OLD.requester_phone IS DISTINCT FROM NEW.requester_phone OR
       OLD.message IS DISTINCT FROM NEW.message THEN
      RAISE EXCEPTION 'Vendors cannot modify requester fields (requester_user_id, requester_name, requester_email, requester_phone, message). Only status and vendor_note can be updated.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to enforce requester field immutability
DROP TRIGGER IF EXISTS prevent_vendor_modify_requester_fields_trigger ON service_inquiries;
CREATE TRIGGER prevent_vendor_modify_requester_fields_trigger
  BEFORE UPDATE ON service_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION prevent_vendor_modify_requester_fields();

-- Update trigger function to also prevent requester_user_id changes
CREATE OR REPLACE FUNCTION prevent_vendor_modify_requester_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- If user is not admin, prevent changes to requester fields
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ) THEN
    -- Vendors can only update status and vendor_note
    -- Ensure requester fields are unchanged
    IF OLD.requester_user_id IS DISTINCT FROM NEW.requester_user_id OR
       OLD.requester_name IS DISTINCT FROM NEW.requester_name OR
       OLD.requester_email IS DISTINCT FROM NEW.requester_email OR
       OLD.requester_phone IS DISTINCT FROM NEW.requester_phone OR
       OLD.message IS DISTINCT FROM NEW.message THEN
      RAISE EXCEPTION 'Vendors cannot modify requester fields (requester_user_id, requester_name, requester_email, requester_phone, message). Only status and vendor_note can be updated.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. Trigger for updated_at
-- ============================================================================

DROP TRIGGER IF EXISTS update_service_inquiries_updated_at ON service_inquiries;
CREATE TRIGGER update_service_inquiries_updated_at
  BEFORE UPDATE ON service_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Summary
-- ============================================================================
-- Created service_inquiries table with corrected schema:
--   - service_id (FK to services)
--   - vendor_id (FK to vendors, for vendor inbox)
--   - owner_user_id (vendor owner user id for RLS)
--   - requester_name, requester_email, requester_phone (contact info)
--   - message (required)
--   - status ('new', 'replied', 'closed')
--   - vendor_note (internal vendor notes)
--
-- RLS Policies:
--   - Public can insert for approved+active services only
--   - Vendors can read their own inquiries (by owner_user_id)
--   - Vendors can update status + vendor_note only (cannot change requester fields)
--   - Admins can manage all
-- ============================================================================