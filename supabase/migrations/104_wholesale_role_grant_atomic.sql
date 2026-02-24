-- ============================================================================
-- Atomic wholesale role grant to avoid read/modify/write races on profiles.roles.
-- ============================================================================

SET search_path = public;

DROP FUNCTION IF EXISTS public.admin_grant_wholesale_role(uuid, uuid);

CREATE OR REPLACE FUNCTION public.admin_grant_wholesale_role(
  p_profile_id UUID,
  p_admin_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Caller must be in admin_users.
  IF NOT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = p_admin_user_id) THEN
    RAISE EXCEPTION 'admin_grant_wholesale_role: not admin'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.profiles p
  SET
    roles = CASE
      WHEN p.roles IS NULL THEN ARRAY['wholesale']::TEXT[]
      WHEN 'wholesale' = ANY(p.roles) THEN p.roles
      ELSE array_append(p.roles, 'wholesale')
    END,
    updated_at = now()
  WHERE p.id = p_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_grant_wholesale_role: profile not found'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_wholesale_role(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_grant_wholesale_role(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_grant_wholesale_role(uuid, uuid) TO authenticated;
