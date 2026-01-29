-- ============================================================================
-- Profile media buckets + profile columns (idempotent)
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS border_style TEXT;

-- Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-avatars', 'profile-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-banners', 'profile-banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policies (storage.objects should already have RLS enabled in Supabase)
DROP POLICY IF EXISTS "Profile media: public read" ON storage.objects;
DROP POLICY IF EXISTS "Profile media: owner upload" ON storage.objects;
DROP POLICY IF EXISTS "Profile media: owner delete" ON storage.objects;

CREATE POLICY "Profile media: public read" ON storage.objects
  FOR SELECT USING (bucket_id IN ('profile-avatars', 'profile-banners'));

CREATE POLICY "Profile media: owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('profile-avatars', 'profile-banners')
    AND name LIKE auth.uid() || '/%'
  );

CREATE POLICY "Profile media: owner delete" ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('profile-avatars', 'profile-banners')
    AND owner = auth.uid()
  );
