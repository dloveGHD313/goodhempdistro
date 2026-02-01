-- Admin action audit log for product moderation (and future entity types)
-- Idempotent: safe to run multiple times

CREATE TABLE IF NOT EXISTS public.admin_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID NULL,
  actor_email TEXT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'product',
  entity_id UUID NOT NULL,
  prev_status TEXT NULL,
  new_status TEXT NULL,
  reason TEXT NULL,
  metadata JSONB NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_created_at
  ON public.admin_action_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_entity
  ON public.admin_action_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_action
  ON public.admin_action_logs (action);
CREATE INDEX IF NOT EXISTS idx_admin_action_logs_actor_email
  ON public.admin_action_logs (actor_email);

ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (app uses admin client for inserts; audit page uses admin client)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admin_action_logs' AND policyname = 'admin_action_logs_service_role_only'
  ) THEN
    CREATE POLICY "admin_action_logs_service_role_only"
      ON public.admin_action_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.admin_action_logs IS 'Audit log for admin moderation actions (approve, reject, set_active, set_inactive, delete)';
