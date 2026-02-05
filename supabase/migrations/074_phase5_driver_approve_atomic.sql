-- ============================================================================
-- Phase 5: Atomic driver approve — driver rows linkable to application, no orphans
-- Run after 073_phase5_logistics_delivery.sql
-- ============================================================================

-- 1. drivers: add application and applicant identity columns
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS application_id UUID NULL REFERENCES public.logistics_applications(id) ON DELETE SET NULL;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS applicant_email TEXT NULL;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS applicant_name TEXT NULL;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS applicant_phone TEXT NULL;

-- One driver per application (allow multiple rows with application_id NULL for legacy)
CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_application_id_unique
  ON public.drivers (application_id)
  WHERE application_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_drivers_applicant_email_lower
  ON public.drivers (lower(applicant_email))
  WHERE applicant_email IS NOT NULL;

-- 2. SECURITY DEFINER RPC: atomic approve (lock application, insert driver, update application)
DROP FUNCTION IF EXISTS public.admin_approve_driver_application(uuid, uuid);

CREATE OR REPLACE FUNCTION public.admin_approve_driver_application(
  p_application_id UUID,
  p_admin_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app RECORD;
  v_profile_id UUID;
  v_driver_id UUID;
BEGIN
  -- Caller must be in admin_users (source of truth for admin)
  IF NOT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = p_admin_user_id) THEN
    RAISE EXCEPTION 'admin_approve_driver_application: not admin'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Lock and load application
  SELECT id, full_name, email, phone, status
  INTO v_app
  FROM public.logistics_applications
  WHERE id = p_application_id
    AND type = 'on_demand_driver'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_approve_driver_application: application not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_app.status != 'pending' THEN
    RAISE EXCEPTION 'admin_approve_driver_application: application already reviewed'
      USING ERRCODE = 'P0001';
  END IF;

  -- Resolve profile by email (case-insensitive; at most one)
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE lower(email) = lower(trim(v_app.email))
  LIMIT 1;

  -- Insert driver with application + applicant identity (always identifiable)
  INSERT INTO public.drivers (
    application_id,
    applicant_email,
    applicant_name,
    applicant_phone,
    profile_id,
    user_id,
    status
  ) VALUES (
    p_application_id,
    trim(v_app.email),
    trim(v_app.full_name),
    NULLIF(trim(v_app.phone), ''),
    v_profile_id,
    v_profile_id,
    'approved'
  )
  RETURNING id INTO v_driver_id;

  -- Then mark application approved
  UPDATE public.logistics_applications
  SET
    status = 'approved',
    reviewed_by = p_admin_user_id,
    reviewed_at = now(),
    rejection_reason = NULL
  WHERE id = p_application_id;

  RETURN v_driver_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_approve_driver_application(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_approve_driver_application(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_approve_driver_application(uuid, uuid) TO authenticated;
