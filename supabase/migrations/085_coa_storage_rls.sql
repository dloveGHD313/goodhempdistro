-- ============================================================================
-- Phase 2 COA: storage policies for vendor-isolated paths
-- Path convention: vendors/{owner_user_id}/products/{product_id}/coa/{uuid-or-filename}
-- No cross-vendor access; product creation never blocked by COA.
-- ============================================================================

-- Drop all existing COA policies so we own the rules
DROP POLICY IF EXISTS "COAs: public read" ON storage.objects;
DROP POLICY IF EXISTS "COAs: public read approved listings" ON storage.objects;
DROP POLICY IF EXISTS "COAs: upload product folder" ON storage.objects;
DROP POLICY IF EXISTS "COAs: upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "COAs: authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "COAs: vendor upload" ON storage.objects;
DROP POLICY IF EXISTS "COAs: vendor read own" ON storage.objects;
DROP POLICY IF EXISTS "COAs: vendor update own" ON storage.objects;
DROP POLICY IF EXISTS "COAs: vendor delete own" ON storage.objects;
DROP POLICY IF EXISTS "COAs: vendor manage" ON storage.objects;

-- INSERT: only into own vendor folder (vendors/{auth.uid()}/products/.../coa/...)
CREATE POLICY "COAs: vendor insert isolated path" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'coas'
    AND (storage.foldername(name))[1] = 'vendors'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND cardinality(storage.foldername(name)) >= 5
    AND (storage.foldername(name))[3] = 'products'
    AND (storage.foldername(name))[5] = 'coa'
  );

-- SELECT: vendor sees own path; admin sees all in coas bucket
CREATE POLICY "COAs: vendor or admin select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'coas'
    AND (
      ((storage.foldername(name))[1] = 'vendors' AND (storage.foldername(name))[2] = auth.uid()::text)
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
  );

-- UPDATE: same as select (vendor own or admin)
CREATE POLICY "COAs: vendor or admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'coas'
    AND (
      ((storage.foldername(name))[1] = 'vendors' AND (storage.foldername(name))[2] = auth.uid()::text)
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'coas'
    AND (
      ((storage.foldername(name))[1] = 'vendors' AND (storage.foldername(name))[2] = auth.uid()::text)
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
  );

-- DELETE: same (vendor own or admin)
CREATE POLICY "COAs: vendor or admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'coas'
    AND (
      ((storage.foldername(name))[1] = 'vendors' AND (storage.foldername(name))[2] = auth.uid()::text)
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
  );
