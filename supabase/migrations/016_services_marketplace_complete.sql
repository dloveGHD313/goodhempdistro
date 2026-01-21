-- ============================================================================
-- Services Marketplace Complete Migration
-- Good Hemp Distro - Complete services table, pricing, inquiries
-- ============================================================================

-- ============================================================================
-- 1. Extend Services Table - Add Pricing and Metadata
-- ============================================================================

-- Add name field (services can have both title and name, but name is primary for display)
ALTER TABLE services ADD COLUMN IF NOT EXISTS name TEXT;

-- Update: services already has title, so we'll use title as the primary name field
-- Add slug for URLs
ALTER TABLE services ADD COLUMN IF NOT EXISTS slug TEXT;

-- Add pricing fields
ALTER TABLE services ADD COLUMN IF NOT EXISTS pricing_type TEXT 
  CHECK (pricing_type IN ('flat_fee', 'hourly', 'per_project', 'quote_only'));

-- Add price (nullable - required only if not quote_only)
ALTER TABLE services ADD COLUMN IF NOT EXISTS price_cents INTEGER CHECK (price_cents >= 0);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_services_slug ON services(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_services_pricing_type ON services(pricing_type);
CREATE INDEX IF NOT EXISTS idx_services_submitted_at ON services(submitted_at) WHERE submitted_at IS NOT NULL;

-- Composite index for admin review queue
CREATE INDEX IF NOT EXISTS idx_services_status_submitted ON services(status, submitted_at) 
  WHERE status = 'pending_review';

-- Generate slugs for existing services (if any)
UPDATE services
SET slug = lower(regexp_replace(coalesce(name, title), '[^a-z0-9]+', '-', 'gi'))
WHERE slug IS NULL AND (name IS NOT NULL OR title IS NOT NULL);

-- ============================================================================
-- 2. Create Service Inquiries Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' 
    CHECK (status IN ('new', 'contacted', 'closed')),
  vendor_notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_inquiries_service_id ON service_inquiries(service_id);
CREATE INDEX IF NOT EXISTS idx_service_inquiries_user_id ON service_inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_service_inquiries_status ON service_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_service_inquiries_created_at ON service_inquiries(created_at DESC);

-- Enable RLS
ALTER TABLE service_inquiries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_inquiries
-- Users can read their own inquiries
CREATE POLICY "Service inquiries: user can read own" ON service_inquiries
  FOR SELECT USING (auth.uid() = user_id);

-- Vendors can read inquiries for their services
CREATE POLICY "Service inquiries: vendor can read own services" ON service_inquiries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM services 
      WHERE services.id = service_inquiries.service_id 
      AND services.owner_user_id = auth.uid()
    )
  );

-- Public can create inquiries (authenticated or anonymous)
CREATE POLICY "Service inquiries: public can create" ON service_inquiries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM services 
      WHERE services.id = service_inquiries.service_id 
      AND services.status = 'approved' 
      AND services.active = true
    )
  );

-- Admins can read/update all inquiries
CREATE POLICY "Service inquiries: admin can manage all" ON service_inquiries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_service_inquiries_updated_at ON service_inquiries;
CREATE TRIGGER update_service_inquiries_updated_at
  BEFORE UPDATE ON service_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Summary
-- ============================================================================
-- Extended services table:
--   - name (optional, uses title if not set)
--   - slug (for URLs)
--   - pricing_type (flat_fee/hourly/per_project/quote_only)
--   - price_cents (nullable, required if not quote_only)
--
-- Created service_inquiries table:
--   - Links to services and users
--   - Stores inquiry details (name, email, message)
--   - Status tracking (new/contacted/closed)
--   - Vendor notification flag
--   - RLS: users read own, vendors read their service inquiries, public can create, admins manage all
-- ============================================================================