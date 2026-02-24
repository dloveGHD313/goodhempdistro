-- ============================================================================
-- Phase 6: Wholesale applications table, RLS, storage bucket.
-- Credential-based wholesale access; admin approves and profile.roles updated on approve.
-- ============================================================================

SET search_path = public;

-- Table: wholesale_applications
CREATE TABLE IF NOT EXISTS public.wholesale_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  business_name TEXT,
  business_type TEXT,
  company_size TEXT,
  products_sourcing TEXT[],
  certificate_path TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wholesale_applications_status_check
    CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT wholesale_applications_business_type_check
    CHECK (
      business_type IN (
        'hotel', 'apartment_multifamily', 'retail_store', 'restaurant',
        'distributor', 'other', 'na_personal'
      ) OR business_type IS NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_wholesale_applications_user_id ON public.wholesale_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_wholesale_applications_status ON public.wholesale_applications(status);
CREATE INDEX IF NOT EXISTS idx_wholesale_applications_submitted_at ON public.wholesale_applications(submitted_at DESC);

-- updated_at trigger (reuse existing function)
DROP TRIGGER IF EXISTS update_wholesale_applications_updated_at ON public.wholesale_applications;
CREATE TRIGGER update_wholesale_applications_updated_at
  BEFORE UPDATE ON public.wholesale_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.wholesale_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wholesale_applications: user insert own" ON public.wholesale_applications;
CREATE POLICY "wholesale_applications: user insert own" ON public.wholesale_applications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "wholesale_applications: user select own" ON public.wholesale_applications;
CREATE POLICY "wholesale_applications: user select own" ON public.wholesale_applications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "wholesale_applications: user update own" ON public.wholesale_applications;
CREATE POLICY "wholesale_applications: user update own" ON public.wholesale_applications
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND status IN ('pending', 'rejected')
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('pending', 'rejected')
  );

DROP POLICY IF EXISTS "wholesale_applications: admin select all" ON public.wholesale_applications;
CREATE POLICY "wholesale_applications: admin select all" ON public.wholesale_applications
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "wholesale_applications: admin update all" ON public.wholesale_applications;
CREATE POLICY "wholesale_applications: admin update all" ON public.wholesale_applications
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

-- Storage bucket: wholesale-certificates (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('wholesale-certificates', 'wholesale-certificates', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage policies (storage.objects)
DROP POLICY IF EXISTS "wholesale-certificates: user upload own path" ON storage.objects;
CREATE POLICY "wholesale-certificates: user upload own path" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'wholesale-certificates'
    AND (name LIKE auth.uid()::text || '/%')
  );

DROP POLICY IF EXISTS "wholesale-certificates: user read own" ON storage.objects;
CREATE POLICY "wholesale-certificates: user read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'wholesale-certificates'
    AND (name LIKE auth.uid()::text || '/%')
  );

DROP POLICY IF EXISTS "wholesale-certificates: admin read all" ON storage.objects;
CREATE POLICY "wholesale-certificates: admin read all" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'wholesale-certificates'
    AND EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );
