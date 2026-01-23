-- ============================================================================
-- Allow service_role to approve services/products (robust JWT role detection)
-- Fixes P0001 raised by prevent_vendor_approval trigger on status='approved'
-- ============================================================================

-- Update function to allow service_role JWT or admin users
CREATE OR REPLACE FUNCTION prevent_vendor_approval()
RETURNS TRIGGER AS $$
DECLARE
  jwt_role TEXT;
  jwt_claims TEXT;
BEGIN
  -- If trying to set status to 'approved', check if user is admin or service_role
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    jwt_role := current_setting('request.jwt.claim.role', true);

    IF jwt_role IS NULL OR jwt_role = '' THEN
      jwt_claims := current_setting('request.jwt.claims', true);
      IF jwt_claims IS NOT NULL AND jwt_claims <> '' THEN
        jwt_role := (jwt_claims::jsonb->>'role');
      END IF;
    END IF;

    -- Allow service role key (server-side admin client)
    IF jwt_role = 'service_role' THEN
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

-- Re-attach triggers to ensure updated function is in effect (idempotent)
DROP TRIGGER IF EXISTS prevent_vendor_product_approval ON products;
CREATE TRIGGER prevent_vendor_product_approval
  BEFORE UPDATE ON products
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION prevent_vendor_approval();

DROP TRIGGER IF EXISTS prevent_vendor_service_approval ON services;
CREATE TRIGGER prevent_vendor_service_approval
  BEFORE UPDATE ON services
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION prevent_vendor_approval();

-- ============================================================================
-- Note: This migration updates only the trigger function and re-attaches triggers.
-- RLS policies remain unchanged.
-- ============================================================================
