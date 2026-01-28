-- ============================================================================
-- Profile media fields + storage buckets + post priority rank
-- ============================================================================

-- Profile media fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS border_style TEXT;

-- Posts priority rank
ALTER TABLE posts ADD COLUMN IF NOT EXISTS priority_rank INT NOT NULL DEFAULT 99;
CREATE INDEX IF NOT EXISTS idx_posts_priority_rank ON posts(priority_rank);

-- Backfill priority rank for existing posts (default 99)
UPDATE posts SET priority_rank = 99 WHERE priority_rank IS NULL;

-- ============================================================================
-- Storage buckets: avatars + banners (public read)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO UPDATE SET public = true;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profile media: public read bucket" ON storage.objects;
DROP POLICY IF EXISTS "Profile media: upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "Profile media: delete own" ON storage.objects;

CREATE POLICY "Profile media: public read bucket" ON storage.objects
  FOR SELECT USING (bucket_id IN ('avatars', 'banners'));

CREATE POLICY "Profile media: upload own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('avatars', 'banners')
    AND name LIKE auth.uid() || '/%'
  );

CREATE POLICY "Profile media: delete own" ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('avatars', 'banners')
    AND owner = auth.uid()
  );
