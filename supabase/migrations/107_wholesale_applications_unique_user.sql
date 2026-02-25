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
