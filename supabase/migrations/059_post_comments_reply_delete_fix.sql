-- ============================================================================
-- Fix reply delete RLS + admin users table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin users: self read" ON public.admin_users;

CREATE POLICY "Admin users: self read"
ON public.admin_users
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Post comments: public read" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: user insert" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: user update" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: admin update" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: authenticated insert" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: author update" ON public.post_comments;

CREATE POLICY "Post comments: public read"
ON public.post_comments
FOR SELECT TO anon, authenticated
USING (is_deleted = false);

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
  AND deleted_by = auth.uid()
  AND deleted_at IS NOT NULL
);

CREATE POLICY "Post comments: post owner update"
ON public.post_comments
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_comments.post_id
      AND p.author_id = auth.uid()
  )
)
WITH CHECK (
  is_deleted = true
  AND deleted_by = auth.uid()
  AND deleted_at IS NOT NULL
);

CREATE POLICY "Post comments: admin update"
ON public.post_comments
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = auth.uid()
      AND pr.role = 'admin'
  )
)
WITH CHECK (
  is_deleted = true
  AND deleted_by = auth.uid()
  AND deleted_at IS NOT NULL
);
