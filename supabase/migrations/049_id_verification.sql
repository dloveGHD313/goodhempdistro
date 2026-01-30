-- ============================================================================
-- ID verification (uploads + moderation) - idempotent
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.id_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ NULL,
  reviewer_id UUID NULL REFERENCES auth.users(id),
  notes TEXT NULL
);

CREATE TABLE IF NOT EXISTS public.id_verification_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID NOT NULL REFERENCES public.id_verifications(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.id_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.id_verification_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ID verifications: owner select" ON public.id_verifications;
DROP POLICY IF EXISTS "ID verifications: owner insert" ON public.id_verifications;
DROP POLICY IF EXISTS "ID verifications: admin select" ON public.id_verifications;
DROP POLICY IF EXISTS "ID verifications: admin update" ON public.id_verifications;

CREATE POLICY "ID verifications: owner select" ON public.id_verifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "ID verifications: owner insert" ON public.id_verifications
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "ID verifications: admin select" ON public.id_verifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "ID verifications: admin update" ON public.id_verifications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "ID verification files: owner select" ON public.id_verification_files;
DROP POLICY IF EXISTS "ID verification files: owner insert" ON public.id_verification_files;
DROP POLICY IF EXISTS "ID verification files: owner delete" ON public.id_verification_files;
DROP POLICY IF EXISTS "ID verification files: admin select" ON public.id_verification_files;
DROP POLICY IF EXISTS "ID verification files: admin delete" ON public.id_verification_files;

CREATE POLICY "ID verification files: owner select" ON public.id_verification_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.id_verifications v
      WHERE v.id = id_verification_files.verification_id
        AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "ID verification files: owner insert" ON public.id_verification_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.id_verifications v
      WHERE v.id = id_verification_files.verification_id
        AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "ID verification files: owner delete" ON public.id_verification_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.id_verifications v
      WHERE v.id = id_verification_files.verification_id
        AND v.user_id = auth.uid()
    )
  );

CREATE POLICY "ID verification files: admin select" ON public.id_verification_files
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "ID verification files: admin delete" ON public.id_verification_files
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Storage bucket for ID verifications (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('id-verifications', 'id-verifications', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "ID verifications: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "ID verifications: owner read" ON storage.objects;
DROP POLICY IF EXISTS "ID verifications: owner delete" ON storage.objects;
DROP POLICY IF EXISTS "ID verifications: admin read" ON storage.objects;
DROP POLICY IF EXISTS "ID verifications: admin delete" ON storage.objects;

CREATE POLICY "ID verifications: owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'id-verifications'
    AND name LIKE auth.uid() || '/%'
  );

CREATE POLICY "ID verifications: owner read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'id-verifications'
    AND owner = auth.uid()
  );

CREATE POLICY "ID verifications: owner delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'id-verifications'
    AND owner = auth.uid()
  );

CREATE POLICY "ID verifications: admin read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'id-verifications'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "ID verifications: admin delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'id-verifications'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
