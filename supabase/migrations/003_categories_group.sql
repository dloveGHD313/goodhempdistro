-- ============================================================================
-- Categories Group Column Migration
-- Good Hemp Distro - Add group column to categories table
-- ============================================================================

-- ============================================================================
-- Add Group Column to Categories Table
-- ============================================================================
-- Add group column if it doesn't exist
ALTER TABLE categories ADD COLUMN IF NOT EXISTS "group" TEXT;

-- Add CHECK constraint for valid group values
-- Drop constraint if exists first (idempotent)
DO $$ 
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'categories_group_check'
    AND conrelid = (SELECT oid FROM pg_class WHERE relname = 'categories' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
  ) THEN
    ALTER TABLE categories DROP CONSTRAINT categories_group_check;
  END IF;
END $$;

-- Add CHECK constraint
ALTER TABLE categories ADD CONSTRAINT categories_group_check 
  CHECK ("group" IN ('industrial', 'recreational', 'convenience', 'food'));

-- Set default value for existing rows if group is null
UPDATE categories SET "group" = 'industrial' WHERE "group" IS NULL;

-- Make group NOT NULL after setting defaults
ALTER TABLE categories ALTER COLUMN "group" SET NOT NULL;
ALTER TABLE categories ALTER COLUMN "group" SET DEFAULT 'industrial';

-- Add index for group lookups
CREATE INDEX IF NOT EXISTS idx_categories_group ON categories("group");

-- ============================================================================
-- Summary
-- ============================================================================
-- Added "group" column to categories table with CHECK constraint
-- Valid values: 'industrial', 'recreational', 'convenience', 'food'
-- Default value: 'industrial'
-- Index created for efficient group filtering
-- ============================================================================
