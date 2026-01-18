-- ============================================================================
-- Categories Migration
-- Good Hemp Distro - Product categories table and FK update
-- ============================================================================

-- ============================================================================
-- 1. Create Categories Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public can read categories
CREATE POLICY "Categories: public can read" ON categories
  FOR SELECT USING (true);

-- ============================================================================
-- 2. Update Products Table - Add category_id FK
-- ============================================================================
-- Add category_id column if it doesn't exist
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- ============================================================================
-- 3. Optional: Migrate existing category text to categories table
-- ============================================================================
-- This step can be done manually or skipped if starting fresh
-- If you have existing products with category text values, you can:
-- 1. Insert distinct category names into categories table
-- 2. Update products.category_id based on products.category text match

-- ============================================================================
-- Summary
-- ============================================================================
-- Tables created/updated:
--   - categories (created with RLS - public read)
--   - products (updated with category_id FK)
--
-- Note: The old 'category' TEXT column remains for backward compatibility
-- but new code should use category_id.
-- ============================================================================
