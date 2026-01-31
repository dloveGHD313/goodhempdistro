-- ============================================================================
-- Reset post_comments RLS policies (simplified)
-- ============================================================================

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'post_comments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.post_comments', r.policyname);
  END LOOP;
END $$;

-- Public read (non-deleted)
CREATE POLICY "Post comments: public read" ON public.post_comments
  FOR SELECT USING (is_deleted = false);

-- Authenticated insert only
CREATE POLICY "Post comments: user insert" ON public.post_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Author soft delete/update
CREATE POLICY "Post comments: user update" ON public.post_comments
  FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Admin soft delete/update (role only)
CREATE POLICY "Post comments: admin update" ON public.post_comments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- Debug helper for auth.uid() visibility
CREATE OR REPLACE FUNCTION public.debug_auth_uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.debug_auth_uid() TO anon;
GRANT EXECUTE ON FUNCTION public.debug_auth_uid() TO authenticated;
