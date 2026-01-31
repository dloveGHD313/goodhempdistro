-- ============================================================================
-- Fix admin update policy (role only, no is_admin column)
-- ============================================================================

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Post comments: admin update" ON public.post_comments;

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
