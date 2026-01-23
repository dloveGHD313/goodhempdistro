-- ============================================================================
-- COA storage bucket ownership + policies (bucket: coas)
-- ============================================================================

-- Ensure bucket exists (idempotent)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('coas', 'coas', true)
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'storage.buckets table not found';
END $$;

-- Ensure postgres owns storage tables (required for policy changes)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects'
  ) THEN
    IF (
      SELECT pg_catalog.pg_get_userbyid(c.relowner)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'storage' AND c.relname = 'objects'
    ) <> 'postgres' THEN
      EXECUTE 'ALTER TABLE storage.objects OWNER TO postgres';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'buckets'
  ) THEN
    IF (
      SELECT pg_catalog.pg_get_userbyid(c.relowner)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'storage' AND c.relname = 'buckets'
    ) <> 'postgres' THEN
      EXECUTE 'ALTER TABLE storage.buckets OWNER TO postgres';
    END IF;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Policies for COA uploads (canonical key: coas/<uid>/file)
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
    AND (storage.foldername(name))[1] = 'coas'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "COAs: authenticated update" ON storage.objects;
CREATE POLICY "COAs: authenticated update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'coas'
    AND (storage.foldername(name))[1] = 'coas'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'coas'
    AND (storage.foldername(name))[1] = 'coas'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "COAs: authenticated delete" ON storage.objects;
CREATE POLICY "COAs: authenticated delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'coas'
    AND (storage.foldername(name))[1] = 'coas'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
