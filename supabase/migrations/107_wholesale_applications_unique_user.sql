ALTER TABLE public.wholesale_applications
ADD CONSTRAINT wholesale_applications_user_id_key UNIQUE (user_id);
