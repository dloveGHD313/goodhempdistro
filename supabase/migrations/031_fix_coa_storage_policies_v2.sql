-- ============================================================================
-- COA storage policies (bucket: coas) - tolerate both path formats
-- ============================================================================

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "COAs: public read" ON storage.objects;
CREATE POLICY "COAs: public read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'coas'
  );

DROP POLICY IF EXISTS "COAs: authenticated upload" ON storage.objects;
CREATE POLICY "COAs: authenticated upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'coas'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] = 'coas'
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "COAs: authenticated delete" ON storage.objects;
CREATE POLICY "COAs: authenticated delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'coas'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        (storage.foldername(name))[1] = 'coas'
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );
