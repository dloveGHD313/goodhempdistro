-- ============================================================================
-- Atomic wholesale role append: avoid read-modify-write race on profiles.roles.
-- Use array append in SQL so concurrent role changes (onboarding, other admin)
-- are not overwritten.
-- ============================================================================

SET search_path = public;

DROP FUNCTION IF EXISTS public.admin_append_wholesale_role(uuid, uuid);

CREATE OR REPLACE FUNCTION public.admin_append_wholesale_role(
  p_user_id UUID,
  p_admin_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must be in admin_users
  IF NOT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = p_admin_user_id) THEN
    RAISE EXCEPTION 'admin_append_wholesale_role: not admin'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Atomic: append 'wholesale' if not present, deduplicate, update in single statement
  UPDATE public.profiles
  SET
    roles = (
      SELECT array_agg(DISTINCT x ORDER BY x)
      FROM unnest(COALESCE(roles, '{}') || ARRAY['wholesale']::text[]) AS x
    ),
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_append_wholesale_role(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_append_wholesale_role(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_append_wholesale_role(uuid, uuid) TO authenticated;
