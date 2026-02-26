-- ============================================================================
-- 108_restrict_admin_append_wholesale_role.sql
--
-- PURPOSE: Reduce attack surface on an unused SECURITY DEFINER function.
--
-- CONTEXT:
--   Migration 104_wholesale_approve_atomic_role.sql created:
--     public.admin_append_wholesale_role(uuid, uuid)
--   That function was granted EXECUTE to both service_role AND authenticated.
--   The function is NOT called anywhere in application code (the API uses
--   admin_grant_wholesale_role instead). Leaving EXECUTE open to authenticated
--   users means any signed-in user can invoke this RPC directly.
--   The function does guard via admin_users, so only actual admins succeed,
--   but the wider attack surface is unnecessary.
--
-- CHANGE:
--   Revoke EXECUTE from PUBLIC and authenticated.
--   Grant only to service_role (matching the pattern used by all other
--   admin RPC functions in this codebase).
--
-- NOTE: This does NOT drop the function. It only restricts execution rights.
--
-- ⚠️  CEO APPROVAL REQUIRED BEFORE APPLYING TO PRODUCTION ⚠️
-- ============================================================================

SET search_path = public;

REVOKE ALL ON FUNCTION public.admin_append_wholesale_role(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_append_wholesale_role(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_append_wholesale_role(uuid, uuid) TO service_role;
