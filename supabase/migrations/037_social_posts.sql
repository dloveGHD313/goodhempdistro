-- ============================================================================
-- Social Posts + Media + Likes + Storage Buckets
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_author_role') THEN
    CREATE TYPE post_author_role AS ENUM ('admin', 'vendor', 'consumer', 'affiliate', 'driver');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_author_tier') THEN
    CREATE TYPE post_author_tier AS ENUM ('vip', 'enterprise', 'pro', 'starter', 'none');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_media_type') THEN
    CREATE TYPE post_media_type AS ENUM ('image', 'video');
  END IF;
END $$;

-- ============================================================================
-- Posts
-- ============================================================================
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_role post_author_role NOT NULL,
  author_tier post_author_tier NOT NULL DEFAULT 'none',
  content TEXT NOT NULL,
  is_admin_post BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_role_tier ON posts(author_role, author_tier);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Posts: public read" ON posts;
DROP POLICY IF EXISTS "Posts: owner insert" ON posts;
DROP POLICY IF EXISTS "Posts: owner update" ON posts;
DROP POLICY IF EXISTS "Posts: owner delete" ON posts;

CREATE POLICY "Posts: public read" ON posts
  FOR SELECT USING (true);

CREATE POLICY "Posts: owner insert" ON posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Posts: owner update" ON posts
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Posts: owner delete" ON posts
  FOR DELETE USING (
    auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- Post Media
-- ============================================================================
CREATE TABLE IF NOT EXISTS post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  media_type post_media_type NOT NULL,
  media_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON post_media(post_id);

ALTER TABLE post_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Post media: public read" ON post_media;
DROP POLICY IF EXISTS "Post media: owner insert" ON post_media;
DROP POLICY IF EXISTS "Post media: owner delete" ON post_media;

CREATE POLICY "Post media: public read" ON post_media
  FOR SELECT USING (true);

CREATE POLICY "Post media: owner insert" ON post_media
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_media.post_id
      AND posts.author_id = auth.uid()
    )
  );

CREATE POLICY "Post media: owner delete" ON post_media
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_media.post_id
      AND posts.author_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- Post Likes
-- ============================================================================
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Post likes: public read" ON post_likes;
DROP POLICY IF EXISTS "Post likes: user insert" ON post_likes;
DROP POLICY IF EXISTS "Post likes: user delete" ON post_likes;

CREATE POLICY "Post likes: public read" ON post_likes
  FOR SELECT USING (true);

CREATE POLICY "Post likes: user insert" ON post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Post likes: user delete" ON post_likes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- Storage Buckets: post-images, post-videos
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('post-videos', 'post-videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Post media: public read bucket" ON storage.objects;
DROP POLICY IF EXISTS "Post media: upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "Post media: delete own" ON storage.objects;

CREATE POLICY "Post media: public read bucket" ON storage.objects
  FOR SELECT USING (bucket_id IN ('post-images', 'post-videos'));

CREATE POLICY "Post media: upload own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('post-images', 'post-videos')
    AND name LIKE auth.uid() || '/%'
  );

CREATE POLICY "Post media: delete own" ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('post-images', 'post-videos')
    AND owner = auth.uid()
  );
