-- ============================================================================
-- Ensure profiles.display_name exists (idempotent)
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
