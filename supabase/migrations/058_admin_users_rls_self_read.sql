-- ============================================================================
-- admin_users RLS: allow authenticated users to read own row
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_users_self_read" ON public.admin_users;

CREATE POLICY "admin_users_self_read" ON public.admin_users
FOR SELECT TO authenticated
USING (user_id = auth.uid());
