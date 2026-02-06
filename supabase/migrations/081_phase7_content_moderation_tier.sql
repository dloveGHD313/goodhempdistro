-- ============================================================================
-- Phase 7: content_posts (unified content), moderation_events, tier priority
-- Posts/feed already exist (037); this adds moderation events + content flag.
-- ============================================================================

-- Moderation events (content_id can reference posts.id or future content_posts)
CREATE TABLE IF NOT EXISTS public.moderation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'post' CHECK (content_type IN ('post', 'video', 'live')),
  reason TEXT,
  action TEXT NOT NULL CHECK (action IN ('queued', 'allowed', 'removed', 'flagged')),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_events_content_id ON public.moderation_events(content_id);
CREATE INDEX IF NOT EXISTS idx_moderation_events_action ON public.moderation_events(action);

ALTER TABLE public.moderation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moderation_events: admin read" ON public.moderation_events;
CREATE POLICY "moderation_events: admin read" ON public.moderation_events
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

DROP POLICY IF EXISTS "moderation_events: admin insert" ON public.moderation_events;
CREATE POLICY "moderation_events: admin insert" ON public.moderation_events
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));

COMMENT ON TABLE public.moderation_events IS 'Content moderation log. action: allowed | removed | flagged. Tier priority: use posts.author_tier/author_role for feed ordering (higher tier = higher weight).';
