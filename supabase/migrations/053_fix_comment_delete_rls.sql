-- ============================================================================
-- Fix comment delete RLS (allow soft-delete updates)
-- ============================================================================

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- Ensure existing policies are replaced with WITH CHECK variants
DROP POLICY IF EXISTS "Post comments: user update" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: admin update" ON public.post_comments;

CREATE POLICY "Post comments: user update" ON public.post_comments
  FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Post comments: admin update" ON public.post_comments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR is_admin = true)
    )
  );
