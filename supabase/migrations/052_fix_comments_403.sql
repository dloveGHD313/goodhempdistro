-- ============================================================================
-- Fix comments 403: profiles identity policy + RPC grants
-- ============================================================================

-- Ensure public profile identity policy exists
DROP POLICY IF EXISTS "Profiles: public read identity" ON public.profiles;
CREATE POLICY "Profiles: public read identity" ON public.profiles
FOR SELECT
USING (true);

-- Ensure RPC exists for identity lookups
CREATE OR REPLACE FUNCTION public.get_profiles_identity(author_ids UUID[])
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  username TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  border_style TEXT,
  role TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.display_name, p.username, p.avatar_url, p.banner_url, p.border_style, p.role
  FROM public.profiles p
  WHERE p.id = ANY(author_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profiles_identity(UUID[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_profiles_identity(UUID[]) TO authenticated;
