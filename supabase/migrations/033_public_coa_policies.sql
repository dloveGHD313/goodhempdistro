-- ============================================================================
-- Public COA policies + object path columns
-- ============================================================================

-- Add COA object path columns if missing
ALTER TABLE products ADD COLUMN IF NOT EXISTS coa_object_path TEXT;
ALTER TABLE services ADD COLUMN IF NOT EXISTS coa_object_path TEXT;

-- Ensure bucket exists (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('coas', 'coas', false)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop legacy COA policies
DROP POLICY IF EXISTS "COAs: public read" ON storage.objects;
DROP POLICY IF EXISTS "COAs: authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "COAs: authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "COAs: authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "COAs: vendor upload" ON storage.objects;
DROP POLICY IF EXISTS "COAs: vendor manage" ON storage.objects;
DROP POLICY IF EXISTS "COAs: vendor read own" ON storage.objects;
DROP POLICY IF EXISTS "COAs: vendor update own" ON storage.objects;
DROP POLICY IF EXISTS "COAs: vendor delete own" ON storage.objects;

-- Vendor upload: only into their own folder (name = '<uid>/file')
CREATE POLICY "COAs: vendor upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'coas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Vendor manage: only their own folder
CREATE POLICY "COAs: vendor read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'coas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "COAs: vendor update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'coas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'coas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "COAs: vendor delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'coas'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read: only if referenced by approved + active listing with approved vendor
CREATE POLICY "COAs: public read approved listings" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'coas'
    AND (
      EXISTS (
        SELECT 1
        FROM products p
        JOIN vendors v ON v.id = p.vendor_id
        WHERE p.coa_object_path = storage.objects.name
          AND p.status = 'approved'
          AND p.active = true
          AND v.is_active = true
          AND v.is_approved = true
      )
      OR EXISTS (
        SELECT 1
        FROM services s
        JOIN vendors v ON v.id = s.vendor_id
        WHERE s.coa_object_path = storage.objects.name
          AND s.status = 'approved'
          AND s.active = true
          AND v.is_active = true
          AND v.is_approved = true
      )
    )
  );
