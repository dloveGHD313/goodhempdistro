-- ============================================================================
-- Allow public read access to profiles (idempotent)
-- ============================================================================

DROP POLICY IF EXISTS "Public profiles are viewable" ON public.profiles;

CREATE POLICY "Public profiles are viewable" ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (true);
