-- ============================================================================
-- Seed admin user (hellogoodhempdistros@gmail.com)
-- Run manually if needed: INSERT happens only if user exists in auth.users
-- ============================================================================

INSERT INTO public.admin_users (user_id)
SELECT '224b8688-dc88-40cd-be58-4d4f74625a5b'::uuid
WHERE EXISTS (
  SELECT 1 FROM auth.users WHERE id = '224b8688-dc88-40cd-be58-4d4f74625a5b'::uuid
)
ON CONFLICT (user_id) DO NOTHING;
