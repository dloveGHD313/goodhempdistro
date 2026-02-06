-- ============================================================================
-- Phase 7: Driver compliance documents (required at application time)
-- Links to logistics_applications (on_demand_driver). Same rules all states.
-- ============================================================================

-- Bucket: driver_documents (private; upload via API with service role)
INSERT INTO storage.buckets (id, name, public)
SELECT 'driver_documents', 'driver_documents', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'driver_documents');

-- Table: driver_documents (one row per doc type per application)
CREATE TABLE IF NOT EXISTS public.driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.logistics_applications(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('driver_license', 'vehicle_registration', 'insurance')),
  file_path TEXT NOT NULL,
  expires_at DATE NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'valid', 'expired', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(application_id, doc_type)
);

CREATE INDEX IF NOT EXISTS idx_driver_documents_application_id ON public.driver_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_driver_documents_expires_at ON public.driver_documents(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;

-- Admin can read all (for review)
DROP POLICY IF EXISTS "driver_documents: admin read" ON public.driver_documents;
CREATE POLICY "driver_documents: admin read" ON public.driver_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

-- Insert/update only via service role (API uses admin client)
-- No INSERT policy for anon/auth so only service_role can insert

COMMENT ON TABLE public.driver_documents IS 'Compliance docs for driver applications. Required: driver_license, vehicle_registration, insurance; expires_at required; submission blocked if missing or expired.';
