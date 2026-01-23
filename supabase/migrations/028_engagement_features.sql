-- ============================================================================
-- Engagement features: favorites, reviews, event engagements
-- ============================================================================

-- Favorites
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('vendor','product','service','event')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS favorites_unique_user_entity
  ON favorites(user_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS favorites_user_idx ON favorites(user_id);
CREATE INDEX IF NOT EXISTS favorites_entity_idx ON favorites(entity_type, entity_id);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Favorites: user read own" ON favorites;
DROP POLICY IF EXISTS "Favorites: user insert own" ON favorites;
DROP POLICY IF EXISTS "Favorites: user delete own" ON favorites;

CREATE POLICY "Favorites: user read own" ON favorites
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Favorites: user insert own" ON favorites
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Favorites: user delete own" ON favorites
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product','service','event','vendor')),
  entity_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_unique_user_entity
  ON reviews(user_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS reviews_entity_idx ON reviews(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS reviews_vendor_idx ON reviews(vendor_id);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Derive vendor_id for approved/active entities
CREATE OR REPLACE FUNCTION review_vendor_for_entity(p_entity_type TEXT, p_entity_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_vendor_id UUID;
BEGIN
  IF p_entity_type = 'vendor' THEN
    SELECT v.id INTO v_vendor_id
    FROM vendors v
    WHERE v.id = p_entity_id
      AND v.is_active = true
      AND v.is_approved = true;
    RETURN v_vendor_id;
  ELSIF p_entity_type = 'product' THEN
    SELECT p.vendor_id INTO v_vendor_id
    FROM products p
    JOIN vendors v ON v.id = p.vendor_id
    WHERE p.id = p_entity_id
      AND p.status = 'approved'
      AND p.active = true
      AND v.is_active = true
      AND v.is_approved = true;
    RETURN v_vendor_id;
  ELSIF p_entity_type = 'service' THEN
    SELECT s.vendor_id INTO v_vendor_id
    FROM services s
    JOIN vendors v ON v.id = s.vendor_id
    WHERE s.id = p_entity_id
      AND s.status = 'approved'
      AND s.active = true
      AND v.is_active = true
      AND v.is_approved = true;
    RETURN v_vendor_id;
  ELSIF p_entity_type = 'event' THEN
    SELECT e.vendor_id INTO v_vendor_id
    FROM events e
    JOIN vendors v ON v.id = e.vendor_id
    WHERE e.id = p_entity_id
      AND e.status IN ('approved','published')
      AND v.is_active = true
      AND v.is_approved = true;
    RETURN v_vendor_id;
  END IF;

  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION prevent_review_entity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.entity_type <> OLD.entity_type OR NEW.entity_id <> OLD.entity_id THEN
    RAISE EXCEPTION 'Review entity cannot be changed';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS prevent_review_entity_change ON reviews;
CREATE TRIGGER prevent_review_entity_change
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION prevent_review_entity_change();

DROP POLICY IF EXISTS "Reviews: public read published" ON reviews;
DROP POLICY IF EXISTS "Reviews: user insert own" ON reviews;
DROP POLICY IF EXISTS "Reviews: user update own" ON reviews;
DROP POLICY IF EXISTS "Reviews: user delete own" ON reviews;

CREATE POLICY "Reviews: public read published" ON reviews
  FOR SELECT
  USING (
    status = 'published'
    AND vendor_id = review_vendor_for_entity(entity_type, entity_id)
  );

CREATE POLICY "Reviews: user insert own" ON reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'published'
    AND vendor_id = review_vendor_for_entity(entity_type, entity_id)
  );

CREATE POLICY "Reviews: user update own" ON reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'published'
    AND vendor_id = review_vendor_for_entity(entity_type, entity_id)
  );

CREATE POLICY "Reviews: user delete own" ON reviews
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Event engagements
CREATE TABLE IF NOT EXISTS event_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('interested','going')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS event_engagements_event_idx ON event_engagements(event_id);
CREATE INDEX IF NOT EXISTS event_engagements_status_idx ON event_engagements(status);

ALTER TABLE event_engagements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Event engagements: user read own" ON event_engagements;
DROP POLICY IF EXISTS "Event engagements: user insert own" ON event_engagements;
DROP POLICY IF EXISTS "Event engagements: user update own" ON event_engagements;
DROP POLICY IF EXISTS "Event engagements: user delete own" ON event_engagements;

CREATE POLICY "Event engagements: user read own" ON event_engagements
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Event engagements: user insert own" ON event_engagements
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Event engagements: user update own" ON event_engagements
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Event engagements: user delete own" ON event_engagements
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
