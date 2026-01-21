-- ============================================================================
-- Categories Hierarchy Migration
-- Good Hemp Distro - Add parent_id, requires_coa, slug, category_type
-- ============================================================================

-- ============================================================================
-- 1. Add Hierarchy and COA Columns
-- ============================================================================

-- Add parent_id for hierarchical categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Add requires_coa (default false, will be set per category)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS requires_coa BOOLEAN NOT NULL DEFAULT false;

-- Add slug for URL-friendly category identification
ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug TEXT;

-- Add category_type (product vs service)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS category_type TEXT NOT NULL DEFAULT 'product' 
  CHECK (category_type IN ('product', 'service'));

-- Remove UNIQUE constraint on name to allow same name in different parent contexts
-- But keep uniqueness with parent_id (same name can't be duplicated under same parent)
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_key;

-- Create unique constraint on (parent_id, name) - allows same name at different levels
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_parent_name_unique 
  ON categories(COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_requires_coa ON categories(requires_coa);
CREATE INDEX IF NOT EXISTS idx_categories_category_type ON categories(category_type);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug) WHERE slug IS NOT NULL;

-- Generate slugs for existing categories if they don't have them
UPDATE categories 
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- ============================================================================
-- 2. Update RLS Policies
-- ============================================================================
-- Keep existing public read policy, no changes needed

-- ============================================================================
-- Summary
-- ============================================================================
-- Added columns:
--   - parent_id (UUID, FK to categories.id)
--   - requires_coa (BOOLEAN, default false)
--   - slug (TEXT, for URLs)
--   - category_type (TEXT, 'product' or 'service', default 'product')
--
-- Constraints:
--   - Unique index on (parent_id, name) allows hierarchical naming
--   - category_type CHECK constraint ensures valid values
--
-- Indexes created for performance:
--   - idx_categories_parent_id
--   - idx_categories_requires_coa
--   - idx_categories_category_type
--   - idx_categories_slug
-- ============================================================================