-- ============================================================================
-- Backfill profiles.roles from legacy profiles.role where default/empty left
-- existing non-consumer users with roles = ['consumer'].
-- 097 added roles with DEFAULT ARRAY['consumer'], so rows created before the
-- backfill step or that skipped the UPDATE (e.g. due to timing) may still have
-- roles = ['consumer'] while role = 'vendor'|'admin'|'driver'|etc.
-- This migration corrects that without overwriting multi-role or already-set data.
-- Idempotent: safe to run multiple times.
-- ============================================================================

-- 1) Set roles from legacy role where legacy role is meaningful and roles look defaulted.
--    Only touch rows where: role IS NOT NULL, lower(role) <> 'consumer', and
--    (roles IS NULL OR roles = ARRAY['consumer']::text[] OR array_length(roles, 1) IS NULL).
UPDATE public.profiles
SET roles = ARRAY[lower(trim(role))]::text[]
WHERE role IS NOT NULL
  AND lower(trim(role)) <> 'consumer'
  AND (
    roles IS NULL
    OR roles = ARRAY['consumer']::text[]
    OR array_length(roles, 1) IS NULL
  );

-- 2) Ensure no row has NULL or empty roles (defensive).
UPDATE public.profiles
SET roles = ARRAY['consumer']::text[]
WHERE roles IS NULL OR array_length(roles, 1) IS NULL;
