-- ============================================================================
-- Vendor onboarding fields (role-based onboarding + compliance)
-- ============================================================================

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS website TEXT;

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_onboarding_step INTEGER NOT NULL DEFAULT 0;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_onboarding_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_onboarding_completed_at TIMESTAMPTZ;

ALTER TABLE vendors ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS compliance_acknowledged_at TIMESTAMPTZ;

-- ============================================================================
-- Note: vendor_type, state/city/service_areas, is_active/is_approved are defined
-- in migration 024_vendor_discovery_fields.sql
-- ============================================================================
