-- ============================================================================
-- COA storage bucket defaults (bucket: coas)
-- ============================================================================

-- Ensure bucket exists (idempotent)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('coas', 'coas', false)
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'storage.buckets table not found';
END $$;

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Policies are defined in 033_public_coa_policies.sql
