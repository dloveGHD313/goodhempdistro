-- ============================================================================
-- profiles.vendor_status: single source of truth for vendor access
-- ONLY "pending" | "active". Set pending on apply; active ONLY via Stripe webhook.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vendor_status TEXT;

-- Constraint: NULL (non-vendor) or 'pending' or 'active' only
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_vendor_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_vendor_status_check
  CHECK (vendor_status IS NULL OR vendor_status IN ('pending', 'active'));

CREATE INDEX IF NOT EXISTS idx_profiles_vendor_status ON public.profiles(vendor_status);

COMMENT ON COLUMN public.profiles.vendor_status IS 'Vendor access SSOT: pending=applied, active=Stripe-confirmed subscription. Only webhook sets active.';
