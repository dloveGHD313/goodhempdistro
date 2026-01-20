-- ============================================================================
-- Admin RPC: List Vendor Applications
-- Bypasses RLS using SECURITY DEFINER, but verifies caller is admin
-- No service role key required
-- ============================================================================

-- Drop function if exists (idempotent)
DROP FUNCTION IF EXISTS public.admin_list_vendor_applications();

-- Create function that returns all vendor applications (admin-only)
-- Includes user email from profiles for convenience
CREATE OR REPLACE FUNCTION public.admin_list_vendor_applications()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  business_name text,
  description text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  user_email text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    va.id,
    va.user_id,
    va.business_name,
    va.description,
    va.status,
    va.created_at,
    va.updated_at,
    p.email as user_email
  FROM public.vendor_applications va
  LEFT JOIN public.profiles p ON p.id = va.user_id
  WHERE EXISTS (
    SELECT 1 
    FROM public.profiles admin_check
    WHERE admin_check.id = auth.uid()
    AND admin_check.role = 'admin'
  )
  ORDER BY va.created_at DESC;
$$;

-- Revoke all permissions from public
REVOKE ALL ON FUNCTION public.admin_list_vendor_applications() FROM public;

-- Grant execute to authenticated users (RLS check inside function)
GRANT EXECUTE ON FUNCTION public.admin_list_vendor_applications() TO authenticated;

-- ============================================================================
-- Verification: Test that function exists and has correct permissions
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    AND p.proname = 'admin_list_vendor_applications'
  ) THEN
    RAISE EXCEPTION 'Function admin_list_vendor_applications was not created';
  END IF;
  
  RAISE NOTICE 'Function admin_list_vendor_applications created successfully';
END $$;
