-- ============================================================================
-- Public profile identity read (idempotent)
-- ============================================================================
-- Verification (read-only):
-- select id, display_name, username, avatar_url from public.profiles limit 5;

DROP POLICY IF EXISTS "Public profiles identity read" ON public.profiles;

CREATE POLICY "Public profiles identity read" ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (true);
