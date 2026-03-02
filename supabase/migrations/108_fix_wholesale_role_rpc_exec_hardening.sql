-- ============================================================================
-- 108_fix_wholesale_role_rpc_exec_hardening.sql
-- Purpose:
--   Prevent migration/runtime failures when only one legacy RPC name exists.
--   Harden EXECUTE permissions for both possible wholesale role RPC functions.
--
-- Supersedes: 108_restrict_admin_append_wholesale_role.sql (deleted).
--   That file did bare REVOKE/GRANT without an existence guard and only covered
--   admin_append_wholesale_role. This migration covers both RPC names safely.
-- ============================================================================

SET search_path = public;

DO $$
BEGIN
  -- Handle legacy function name: admin_append_wholesale_role(uuid, uuid)
  IF to_regprocedure('public.admin_append_wholesale_role(uuid, uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.admin_append_wholesale_role(uuid, uuid) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.admin_append_wholesale_role(uuid, uuid) FROM anon;
    REVOKE ALL ON FUNCTION public.admin_append_wholesale_role(uuid, uuid) FROM authenticated;
    GRANT EXECUTE ON FUNCTION public.admin_append_wholesale_role(uuid, uuid) TO service_role;
  END IF;

  -- Handle canonical function name: admin_grant_wholesale_role(uuid, uuid)
  IF to_regprocedure('public.admin_grant_wholesale_role(uuid, uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.admin_grant_wholesale_role(uuid, uuid) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.admin_grant_wholesale_role(uuid, uuid) FROM anon;
    REVOKE ALL ON FUNCTION public.admin_grant_wholesale_role(uuid, uuid) FROM authenticated;
    GRANT EXECUTE ON FUNCTION public.admin_grant_wholesale_role(uuid, uuid) TO service_role;
  END IF;
END
$$;
