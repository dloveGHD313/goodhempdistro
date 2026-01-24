-- ============================================================================
-- COA storage: public read + canonical upload path (coas/<uid>/...)
-- ============================================================================

-- Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('coas', 'coas', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop conflicting/legacy COA policies
DROP POLICY IF EXISTS "COAs: public read" ON storage.objects;
DROP POLICY IF EXISTS "COAs: authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "COAs: authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "COAs: vendor upload" ON storage.objects;
DROP POLICY IF EXISTS "COAs: vendor manage" ON storage.objects;
DROP POLICY IF EXISTS "COAs: vendor read own" ON storage.objects;
DROP POLICY IF EXISTS "COAs: vendor update own" ON storage.objects;
DROP POLICY IF EXISTS "COAs: vendor delete own" ON storage.objects;
DROP POLICY IF EXISTS "COAs: public read approved listings" ON storage.objects;

-- Public read for all COAs (anonymous allowed)
CREATE POLICY "COAs: public read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'coas'
  );

-- Authenticated upload only to coas/<auth.uid()>/...
CREATE POLICY "COAs: upload own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'coas'
    AND name LIKE 'coas/' || auth.uid()::text || '/%'
  );
