-- ============================================================================
-- Fix post_comments RLS for DELETE operations (comments + replies)
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Post comments: public read" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: user insert" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: user update" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: admin update" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: authenticated insert" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: author update" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: admin update" ON public.post_comments;

-- Public read: non-deleted comments and replies
CREATE POLICY "Post comments: public read"
ON public.post_comments
FOR SELECT
USING (is_deleted = false);

-- Authenticated insert: user can create comments/replies as themselves
CREATE POLICY "Post comments: authenticated insert"
ON public.post_comments
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = author_id
);

-- Author update: user can soft-delete their own comments/replies
CREATE POLICY "Post comments: author update"
ON public.post_comments
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND auth.uid() = author_id
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND auth.uid() = author_id
);

-- Admin update: admin can soft-delete any comment/reply
CREATE POLICY "Post comments: admin update"
ON public.post_comments
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

-- Debug helper to verify auth.uid() in route handlers
CREATE OR REPLACE FUNCTION public.debug_auth_uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.debug_auth_uid() TO anon;
GRANT EXECUTE ON FUNCTION public.debug_auth_uid() TO authenticated;
