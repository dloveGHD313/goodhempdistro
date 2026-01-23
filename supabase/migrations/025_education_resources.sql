-- ============================================================================
-- Education resources (state-level placeholder content)
-- ============================================================================

CREATE TABLE IF NOT EXISTS education_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  state TEXT,
  url TEXT,
  experience_level TEXT NOT NULL DEFAULT 'all'
    CHECK (experience_level IN ('new', 'experienced', 'all')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_education_resources_state ON education_resources(state);
CREATE INDEX IF NOT EXISTS idx_education_resources_experience ON education_resources(experience_level);

ALTER TABLE education_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Education resources: public read" ON education_resources;
CREATE POLICY "Education resources: public read" ON education_resources
  FOR SELECT USING (true);

DROP TRIGGER IF EXISTS update_education_resources_updated_at ON education_resources;
CREATE TRIGGER update_education_resources_updated_at
  BEFORE UPDATE ON education_resources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Seed placeholder entries (safe to rerun)
INSERT INTO education_resources (slug, title, summary, state, url, experience_level)
VALUES
  (
    'education-general-overview',
    'Hemp compliance overview',
    'Placeholder: state-by-state requirements will be added here.',
    NULL,
    NULL,
    'all'
  ),
  (
    'education-new-consumers',
    'Getting started with hemp purchasing',
    'Placeholder: guidance for new consumers by region.',
    NULL,
    NULL,
    'new'
  )
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  state = EXCLUDED.state,
  url = EXCLUDED.url,
  experience_level = EXCLUDED.experience_level,
  updated_at = NOW();
