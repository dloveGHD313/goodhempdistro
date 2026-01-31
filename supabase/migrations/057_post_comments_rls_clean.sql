-- ============================================================================
-- Clean post_comments RLS policies for soft delete
-- ============================================================================

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

DROP POLICY IF EXISTS "Post comments: public read" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: user insert" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: user update" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: admin update" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: authenticated insert" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: author update" ON public.post_comments;

CREATE POLICY "Post comments: public read"
ON public.post_comments
FOR SELECT TO anon, authenticated
USING (deleted_at IS NULL);

CREATE POLICY "Post comments: authenticated insert"
ON public.post_comments
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Post comments: author update"
ON public.post_comments
FOR UPDATE TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (
  auth.uid() = author_id
  AND is_deleted = true
  AND deleted_at IS NOT NULL
);

CREATE POLICY "Post comments: admin update"
ON public.post_comments
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
  AND is_deleted = true
  AND deleted_at IS NOT NULL
);
