-- ============================================================================
-- Public profile identity RPC (idempotent)
-- ============================================================================
-- This RPC returns ONLY safe identity fields for feed rendering.
-- Verification (read-only):
-- select * from public.get_profiles_identity(array[]::uuid[]);

CREATE OR REPLACE FUNCTION public.get_profiles_identity(author_ids uuid[])
RETURNS TABLE (
  id uuid,
  display_name text,
  username text,
  avatar_url text,
  banner_url text,
  border_style text,
  role text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id,
    display_name,
    username,
    avatar_url,
    banner_url,
    border_style,
    role
  FROM public.profiles
  WHERE id = ANY(author_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_profiles_identity(uuid[]) TO anon, authenticated;
