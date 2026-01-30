-- ============================================================================
-- Post comments + replies (idempotent)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT post_comments_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id_created_at
  ON public.post_comments(post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id_created_at
  ON public.post_comments(parent_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_post_comments_author_id
  ON public.post_comments(author_id);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Post comments: public read" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: user insert" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: user update" ON public.post_comments;
DROP POLICY IF EXISTS "Post comments: admin update" ON public.post_comments;

CREATE POLICY "Post comments: public read" ON public.post_comments
  FOR SELECT USING (is_deleted = false);

CREATE POLICY "Post comments: user insert" ON public.post_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Post comments: user update" ON public.post_comments
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Post comments: admin update" ON public.post_comments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Update updated_at on changes
DROP TRIGGER IF EXISTS update_post_comments_updated_at ON public.post_comments;
CREATE TRIGGER update_post_comments_updated_at
  BEFORE UPDATE ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
