-- ============================================================================
-- Sync profiles verification status from id_verifications (idempotent)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_profile_verification_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    UPDATE public.profiles
    SET
      age_verified = true,
      id_verification_status = 'approved',
      id_verified_at = COALESCE(NEW.reviewed_at, now())
    WHERE id = NEW.user_id;
  ELSIF NEW.status = 'rejected' THEN
    UPDATE public.profiles
    SET
      age_verified = false,
      id_verification_status = 'rejected',
      id_verified_at = NULL
    WHERE id = NEW.user_id;
  ELSE
    UPDATE public.profiles
    SET
      age_verified = false,
      id_verification_status = 'pending',
      id_verified_at = NULL
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_verification_status_on_insert ON public.id_verifications;
CREATE TRIGGER sync_profile_verification_status_on_insert
AFTER INSERT ON public.id_verifications
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_verification_status();

DROP TRIGGER IF EXISTS sync_profile_verification_status_on_update ON public.id_verifications;
CREATE TRIGGER sync_profile_verification_status_on_update
AFTER UPDATE OF status, reviewed_at ON public.id_verifications
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at)
EXECUTE FUNCTION public.sync_profile_verification_status();
