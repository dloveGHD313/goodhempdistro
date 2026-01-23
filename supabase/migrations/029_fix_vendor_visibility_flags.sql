-- ============================================================================
-- Backfill vendor visibility flags for approved vendors
-- ============================================================================

UPDATE vendors
SET is_approved = true
WHERE status = 'active'
  AND (is_approved IS NULL OR is_approved = false);

UPDATE vendors
SET is_active = true
WHERE status = 'active'
  AND (is_active IS NULL OR is_active = false);

UPDATE vendors
SET is_active = false
WHERE status = 'suspended'
  AND (is_active IS NULL OR is_active = true);
