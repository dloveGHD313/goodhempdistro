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
  requester_name TEXT,
  requester_email TEXT NOT NULL,
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
CREATE POLICY "Service inquiries: public can create for approved active services" ON service_inquiries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM services 
      WHERE services.id = service_inquiries.service_id 
      AND services.status = 'approved' 
      AND services.active = true
    )
  );

-- Vendor (auth): can select inquiries where owner_user_id = auth.uid()
CREATE POLICY "Service inquiries: vendor can read own" ON service_inquiries
  FOR SELECT USING (auth.uid() = owner_user_id);

-- Vendor (auth): can update status + vendor_note where owner_user_id = auth.uid()
-- Cannot change requester fields (requester_name, requester_email, requester_phone, message)
CREATE POLICY "Service inquiries: vendor can update status and notes" ON service_inquiries
  FOR UPDATE USING (auth.uid() = owner_user_id)
  WITH CHECK (
    auth.uid() = owner_user_id
    AND OLD.requester_name = NEW.requester_name
    AND OLD.requester_email = NEW.requester_email
    AND OLD.requester_phone IS NOT DISTINCT FROM NEW.requester_phone
    AND OLD.message = NEW.message
  );

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
-- 6. Trigger for updated_at
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