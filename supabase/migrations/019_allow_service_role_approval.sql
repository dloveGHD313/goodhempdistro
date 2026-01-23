-- ============================================================================
-- Allow service_role to approve services/products
-- Fixes P0001 raised by prevent_vendor_approval trigger for admin updates
-- ============================================================================

-- Update function to allow service_role JWT to approve
CREATE OR REPLACE FUNCTION prevent_vendor_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- If trying to set status to 'approved', check if user is admin or service_role
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Allow service role key (server-side admin client)
    IF auth.role() = 'service_role' THEN
      RETURN NEW;
    END IF;

    -- Allow admin users
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

-- ============================================================================
-- Note: Triggers already reference prevent_vendor_approval() for products/services
-- This migration updates the function only (idempotent).
-- ============================================================================
