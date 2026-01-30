-- ============================================================================
-- Post delete + flagging (idempotent)
-- ============================================================================

-- Soft delete columns for posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Update RLS for posts (allow owner/admin to update or delete)
DROP POLICY IF EXISTS "Posts: owner update" ON public.posts;
DROP POLICY IF EXISTS "Posts: owner delete" ON public.posts;

CREATE POLICY "Posts: owner or admin update" ON public.posts
  FOR UPDATE USING (
    auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Posts: owner or admin delete" ON public.posts
  FOR DELETE USING (
    auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- Post flags
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.post_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  flagged_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'actioned')),
  UNIQUE(post_id, flagged_by)
);

ALTER TABLE public.post_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Post flags: user insert" ON public.post_flags;
DROP POLICY IF EXISTS "Post flags: user read own" ON public.post_flags;
DROP POLICY IF EXISTS "Post flags: admin read" ON public.post_flags;
DROP POLICY IF EXISTS "Post flags: admin update" ON public.post_flags;
DROP POLICY IF EXISTS "Post flags: admin delete" ON public.post_flags;

CREATE POLICY "Post flags: user insert" ON public.post_flags
  FOR INSERT WITH CHECK (auth.uid() = flagged_by);

CREATE POLICY "Post flags: user read own" ON public.post_flags
  FOR SELECT USING (auth.uid() = flagged_by);

CREATE POLICY "Post flags: admin read" ON public.post_flags
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Post flags: admin update" ON public.post_flags
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Post flags: admin delete" ON public.post_flags
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
