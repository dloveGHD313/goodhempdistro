-- ============================================================================
-- ID verification hardening (idempotent)
-- ============================================================================

-- Align columns
ALTER TABLE public.id_verifications
  ADD COLUMN IF NOT EXISTS reviewed_by UUID NULL REFERENCES auth.users(id);

UPDATE public.id_verifications
SET reviewed_by = reviewer_id
WHERE reviewed_by IS NULL
  AND reviewer_id IS NOT NULL;

-- Normalize legacy status values
UPDATE public.id_verifications
SET status = 'approved'
WHERE status = 'verified';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'id_verifications_status_check'
  ) THEN
    ALTER TABLE public.id_verifications
      ADD CONSTRAINT id_verifications_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- RLS: remove owner deletes on files, keep admin deletes
DROP POLICY IF EXISTS "ID verification files: owner delete" ON public.id_verification_files;

DROP POLICY IF EXISTS "ID verification files: admin update" ON public.id_verification_files;
CREATE POLICY "ID verification files: admin update" ON public.id_verification_files
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Storage: disallow owner delete, keep admin delete
DROP POLICY IF EXISTS "ID verifications: owner delete" ON storage.objects;
