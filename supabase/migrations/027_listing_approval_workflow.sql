-- ============================================================================
-- Listing approval workflow enforcement (products, services, events)
-- ============================================================================

-- 1) Events table: add owner_user_id + review fields + status values
ALTER TABLE events ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Backfill owner_user_id from vendors if missing
UPDATE events e
SET owner_user_id = v.owner_user_id
FROM vendors v
WHERE e.vendor_id = v.id
  AND e.owner_user_id IS NULL;

-- Update events status check to support review workflow while keeping existing values
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.events'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.events DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE public.events
    ADD CONSTRAINT events_status_check
    CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'published', 'cancelled'));
END $$;

-- 2) RLS: enforce vendor-only access + approved vendor public access

-- Products public policy: approved + active + vendor approved/active
DROP POLICY IF EXISTS "Products: public can read approved active" ON products;
CREATE POLICY "Products: public can read approved active" ON products
  FOR SELECT USING (
    status = 'approved'
    AND active = true
    AND EXISTS (
      SELECT 1 FROM vendors v
      WHERE v.id = products.vendor_id
        AND v.is_active = true
        AND v.is_approved = true
    )
  );

-- Products vendor policies (insert + update + select)
DROP POLICY IF EXISTS "Products: vendor owner can manage" ON products;
DROP POLICY IF EXISTS "Products: vendor can insert own" ON products;
DROP POLICY IF EXISTS "Products: vendor can update own" ON products;
DROP POLICY IF EXISTS "Products: vendor can select own" ON products;

CREATE POLICY "Products: vendor can insert own" ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_user_id
    AND status IN ('draft', 'pending_review')
  );

CREATE POLICY "Products: vendor can update own" ON products
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Products: vendor can select own" ON products
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_user_id);

-- Services public policy: approved + active + vendor approved/active
DROP POLICY IF EXISTS "Services: public can read approved active" ON services;
CREATE POLICY "Services: public can read approved active" ON services
  FOR SELECT USING (
    status = 'approved'
    AND active = true
    AND EXISTS (
      SELECT 1 FROM vendors v
      WHERE v.id = services.vendor_id
        AND v.is_active = true
        AND v.is_approved = true
    )
  );

-- Services vendor policies
DROP POLICY IF EXISTS "Services: vendor owner can manage" ON services;
DROP POLICY IF EXISTS "Services: vendor can insert own" ON services;
DROP POLICY IF EXISTS "Services: vendor can update own" ON services;
DROP POLICY IF EXISTS "Services: vendor can select own" ON services;

CREATE POLICY "Services: vendor can insert own" ON services
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_user_id
    AND status IN ('draft', 'pending_review')
  );

CREATE POLICY "Services: vendor can update own" ON services
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Services: vendor can select own" ON services
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_user_id);

-- Events public policy: approved/published + vendor approved/active
DROP POLICY IF EXISTS "Events: public can read published" ON events;
CREATE POLICY "Events: public can read approved" ON events
  FOR SELECT USING (
    status IN ('approved', 'published')
    AND EXISTS (
      SELECT 1 FROM vendors v
      WHERE v.id = events.vendor_id
        AND v.is_active = true
        AND v.is_approved = true
    )
  );

-- Events vendor policies
DROP POLICY IF EXISTS "Events: vendor can CRUD own" ON events;
DROP POLICY IF EXISTS "Events: vendor can manage own" ON events;

CREATE POLICY "Events: vendor can manage own" ON events
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- 3) Prevent vendors from self-approving events
DROP TRIGGER IF EXISTS prevent_vendor_event_approval ON events;
CREATE TRIGGER prevent_vendor_event_approval
  BEFORE UPDATE ON events
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION prevent_vendor_approval();

-- ============================================================================
-- Note: Admin/service_role approval is allowed by prevent_vendor_approval().
-- ============================================================================
