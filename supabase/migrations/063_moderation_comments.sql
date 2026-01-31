-- ============================================================================
-- Comment moderation: fields, reports table, RLS
-- ============================================================================

-- Moderation fields on post_comments
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_rank INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_note TEXT;

-- post_comment_reports table
CREATE TABLE IF NOT EXISTS public.post_comment_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed', 'actioned'))
);

CREATE INDEX IF NOT EXISTS idx_post_comment_reports_comment_id ON public.post_comment_reports(comment_id);
CREATE INDEX IF NOT EXISTS idx_post_comment_reports_status ON public.post_comment_reports(status);

ALTER TABLE public.post_comment_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_comment_reports: authenticated insert own" ON public.post_comment_reports;
DROP POLICY IF EXISTS "post_comment_reports: admin select" ON public.post_comment_reports;
DROP POLICY IF EXISTS "post_comment_reports: admin update" ON public.post_comment_reports;

CREATE POLICY "post_comment_reports: authenticated insert own"
ON public.post_comment_reports
FOR INSERT TO authenticated
WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "post_comment_reports: admin select"
ON public.post_comment_reports
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
);

CREATE POLICY "post_comment_reports: admin update"
ON public.post_comment_reports
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
);

-- post_comments RLS updates
-- Admins: SELECT all (including deleted), UPDATE moderation fields
-- Public: SELECT non-deleted (keep existing)
-- Insert: authenticated with author_id (lock check enforced in API)

DROP POLICY IF EXISTS "Post comments: public read" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: authenticated insert" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: author update" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: post owner update" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: admin update" ON public.post_comments;

CREATE POLICY "Post comments: public read"
ON public.post_comments
FOR SELECT TO anon, authenticated
USING (is_deleted = false);

CREATE POLICY "Post comments: admin select all"
ON public.post_comments
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
);

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
    WHERE p.id = post_comments.post_id AND p.author_id = auth.uid()
  )
)
WITH CHECK (
  is_deleted = true
  AND deleted_by = auth.uid()
  AND deleted_at IS NOT NULL
);

-- Admin can update any field (moderation fields, soft delete, etc.)
CREATE POLICY "Post comments: admin update"
ON public.post_comments
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
);
