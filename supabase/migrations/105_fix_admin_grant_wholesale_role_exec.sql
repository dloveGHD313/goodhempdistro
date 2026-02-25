-- 105_fix_admin_grant_wholesale_role_exec.sql
-- Closes RPC privilege escalation: removes EXECUTE from authenticated and public.
-- The API calls this function exclusively via service_role (server-side).
-- Granting EXECUTE to authenticated is unnecessary and exploitable.

REVOKE ALL ON FUNCTION public.admin_grant_wholesale_role(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_grant_wholesale_role(uuid, uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.admin_grant_wholesale_role(uuid, uuid) TO service_role;
