-- ============================================================================
-- Newsletter signups: store emails for Learning with JAX and other opt-ins.
-- API uses service role to insert; no anon insert. Admins can read.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.newsletter_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_signups_email ON public.newsletter_signups (LOWER(TRIM(email)));

ALTER TABLE public.newsletter_signups ENABLE ROW LEVEL SECURITY;

-- Only admins can read (for export/dashboard). Inserts are done server-side via service role.
CREATE POLICY "newsletter_signups: admin can read"
  ON public.newsletter_signups
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

COMMENT ON TABLE public.newsletter_signups IS 'Opt-in emails e.g. Learning with JAX episode notifications. Insert via API (service role).';
