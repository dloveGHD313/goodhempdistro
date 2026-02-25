-- Dedupe wholesale_applications by user_id (keep latest per user), then add UNIQUE constraint.
-- Columns: submitted_at, created_at, id (all exist per migration 103).

WITH ranked AS (
  SELECT
    id,
    user_id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY submitted_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.wholesale_applications
)
DELETE FROM public.wholesale_applications wa
USING ranked r
WHERE wa.id = r.id
  AND r.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wholesale_applications_user_id_key'
      AND conrelid = 'public.wholesale_applications'::regclass
  ) THEN
    ALTER TABLE public.wholesale_applications
      ADD CONSTRAINT wholesale_applications_user_id_key UNIQUE (user_id);
  END IF;
END $$;
