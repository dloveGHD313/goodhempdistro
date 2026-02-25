-- Fix HIGH severity: prevent RPC privilege escalation by restricting EXECUTE
-- on SECURITY DEFINER function public.admin_grant_wholesale_role(uuid, uuid)
-- to service_role only.

REVOKE ALL ON FUNCTION public.admin_grant_wholesale_role(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_grant_wholesale_role(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.admin_grant_wholesale_role(uuid, uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.admin_grant_wholesale_role(uuid, uuid) TO service_role;
