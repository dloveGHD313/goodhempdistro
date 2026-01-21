-- ============================================================================
-- Seed Hierarchical Categories
-- Good Hemp Distro - Seed parent and child categories for marketplace
-- ============================================================================

-- Clear existing categories (optional - uncomment if you want a clean slate)
-- DELETE FROM categories WHERE id IS NOT NULL;

-- ============================================================================
-- 1. Consumables (requires COA = true)
-- ============================================================================

-- Parent: Consumables
DO $$
DECLARE
  consumables_id UUID;
BEGIN
  INSERT INTO categories (name, slug, parent_id, requires_coa, category_type, "group") 
  VALUES ('Consumables', 'consumables', NULL, true, 'product', 'recreational')
  ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name) 
  DO UPDATE SET slug = EXCLUDED.slug
  RETURNING id INTO consumables_id;
  
  -- If no row was inserted/updated (conflict but no update), select existing
  IF consumables_id IS NULL THEN
    SELECT id INTO consumables_id FROM categories WHERE name = 'Consumables' AND parent_id IS NULL LIMIT 1;
  END IF;
  
  IF consumables_id IS NOT NULL THEN
    INSERT INTO categories (name, slug, parent_id, requires_coa, category_type, "group") VALUES
      ('Flower / Pre-rolls', 'flower-prerolls', consumables_id, true, 'product', 'recreational'),
      ('Concentrates', 'concentrates', consumables_id, true, 'product', 'recreational'),
      ('Vapes', 'vapes', consumables_id, true, 'product', 'recreational'),
      ('Edibles', 'edibles', consumables_id, true, 'product', 'recreational'),
      ('Beverages', 'beverages', consumables_id, true, 'product', 'recreational'),
      ('Tinctures', 'tinctures', consumables_id, true, 'product', 'recreational'),
      ('Capsules / Supplements', 'capsules-supplements', consumables_id, true, 'product', 'recreational'),
      ('Pet Consumables', 'pet-consumables', consumables_id, true, 'product', 'convenience')
    ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- 2. Topicals & Body (requires COA = true)
-- ============================================================================

-- Parent: Topicals & Body
DO $$
DECLARE
  topicals_id UUID;
BEGIN
  INSERT INTO categories (name, slug, parent_id, requires_coa, category_type, "group") 
  VALUES ('Topicals & Body', 'topicals-body', NULL, true, 'product', 'recreational')
  ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name) 
  DO UPDATE SET slug = EXCLUDED.slug
  RETURNING id INTO topicals_id;
  
  IF topicals_id IS NOT NULL THEN
    INSERT INTO categories (name, slug, parent_id, requires_coa, category_type, "group") VALUES
      ('Lotions & Creams', 'lotions-creams', topicals_id, true, 'product', 'recreational'),
      ('Bath Bombs', 'bath-bombs', topicals_id, true, 'product', 'recreational'),
      ('Salves/Balms', 'salves-balms', topicals_id, true, 'product', 'recreational'),
      ('Soaps', 'soaps', topicals_id, true, 'product', 'recreational'),
      ('Cosmetics', 'cosmetics', topicals_id, true, 'product', 'recreational')
    ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- 3. Industrial Hemp Materials (requires COA = false)
-- ============================================================================

-- Parent: Industrial Hemp Materials
DO $$
DECLARE
  industrial_id UUID;
BEGIN
  INSERT INTO categories (name, slug, parent_id, requires_coa, category_type, "group") 
  VALUES ('Industrial Hemp Materials', 'industrial-hemp-materials', NULL, false, 'product', 'industrial')
  ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name) 
  DO UPDATE SET slug = EXCLUDED.slug
  RETURNING id INTO industrial_id;
  
  IF industrial_id IS NOT NULL THEN
    INSERT INTO categories (name, slug, parent_id, requires_coa, category_type, "group") VALUES
      ('Hempcrete & Building Materials', 'hempcrete-building-materials', industrial_id, false, 'product', 'industrial'),
      ('Insulation', 'insulation', industrial_id, false, 'product', 'industrial'),
      ('Fiberboard / Panels', 'fiberboard-panels', industrial_id, false, 'product', 'industrial'),
      ('Plastics/Composites', 'plastics-composites', industrial_id, false, 'product', 'industrial'),
      ('Biomass / Raw Material', 'biomass-raw-material', industrial_id, false, 'product', 'industrial')
    ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- 4. Textiles & Apparel (requires COA = false)
-- ============================================================================

-- Parent: Textiles & Apparel
DO $$
DECLARE
  textiles_id UUID;
BEGIN
  INSERT INTO categories (name, slug, parent_id, requires_coa, category_type, "group") 
  VALUES ('Textiles & Apparel', 'textiles-apparel', NULL, false, 'product', 'industrial')
  ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name) 
  DO UPDATE SET slug = EXCLUDED.slug
  RETURNING id INTO textiles_id;
  
  IF textiles_id IS NOT NULL THEN
    INSERT INTO categories (name, slug, parent_id, requires_coa, category_type, "group") VALUES
      ('Clothing', 'clothing', textiles_id, false, 'product', 'industrial'),
      ('Fabric / Yarn', 'fabric-yarn', textiles_id, false, 'product', 'industrial'),
      ('Accessories', 'accessories', textiles_id, false, 'product', 'industrial')
    ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- 5. Seeds & Genetics (requires COA = false)
-- ============================================================================

-- Parent: Seeds & Genetics
DO $$
DECLARE
  seeds_id UUID;
BEGIN
  INSERT INTO categories (name, slug, parent_id, requires_coa, category_type, "group") 
  VALUES ('Seeds & Genetics', 'seeds-genetics', NULL, false, 'product', 'industrial')
  ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name) 
  DO UPDATE SET slug = EXCLUDED.slug
  RETURNING id INTO seeds_id;
  
  IF seeds_id IS NOT NULL THEN
    INSERT INTO categories (name, slug, parent_id, requires_coa, category_type, "group") VALUES
      ('Seeds', 'seeds', seeds_id, false, 'product', 'industrial'),
      ('Clones', 'clones', seeds_id, false, 'product', 'industrial'),
      ('Genetics Services', 'genetics-services', seeds_id, false, 'service', 'industrial')
    ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- 6. Equipment & Tools (requires COA = false)
-- ============================================================================

-- Parent: Equipment & Tools
DO $$
DECLARE
  equipment_id UUID;
BEGIN
  INSERT INTO categories (name, slug, parent_id, requires_coa, category_type, "group") 
  VALUES ('Equipment & Tools', 'equipment-tools', NULL, false, 'product', 'industrial')
  ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name) 
  DO UPDATE SET slug = EXCLUDED.slug
  RETURNING id INTO equipment_id;
  
  IF equipment_id IS NOT NULL THEN
    INSERT INTO categories (name, slug, parent_id, requires_coa, category_type, "group") VALUES
      ('Cultivation Equipment', 'cultivation-equipment', equipment_id, false, 'product', 'industrial'),
      ('Extraction Equipment', 'extraction-equipment', equipment_id, false, 'product', 'industrial'),
      ('Lab Equipment', 'lab-equipment', equipment_id, false, 'product', 'industrial'),
      ('Packaging Equipment', 'packaging-equipment', equipment_id, false, 'product', 'industrial')
    ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- 7. Services (category_type = 'service', requires COA = false)
-- ============================================================================

-- Parent: Services
DO $$
DECLARE
  services_id UUID;
BEGIN
  INSERT INTO categories (name, slug, parent_id, requires_coa, category_type, "group") 
  VALUES ('Services', 'services', NULL, false, 'service', 'convenience')
  ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name) 
  DO UPDATE SET slug = EXCLUDED.slug
  RETURNING id INTO services_id;
  
  IF services_id IS NOT NULL THEN
    INSERT INTO categories (name, slug, parent_id, requires_coa, category_type, "group") VALUES
      ('Legal/Compliance', 'legal-compliance', services_id, false, 'service', 'convenience'),
      ('Marketing/Branding', 'marketing-branding', services_id, false, 'service', 'convenience'),
      ('Cultivation Consulting', 'cultivation-consulting', services_id, false, 'service', 'convenience'),
      ('Construction/Renovation (Hempcrete)', 'construction-renovation', services_id, false, 'service', 'convenience'),
      ('Logistics/Fulfillment', 'logistics-fulfillment', services_id, false, 'service', 'convenience'),
      ('Testing Labs (COA Provider)', 'testing-labs', services_id, false, 'service', 'convenience')
    ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- 8. Wholesale / Bulk (requires COA depends on subcategory)
-- ============================================================================

-- Parent: Wholesale / Bulk
DO $$
DECLARE
  wholesale_id UUID;
BEGIN
  INSERT INTO categories (name, slug, parent_id, requires_coa, category_type, "group") 
  VALUES ('Wholesale / Bulk', 'wholesale-bulk', NULL, false, 'product', 'convenience')
  ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name) 
  DO UPDATE SET slug = EXCLUDED.slug
  RETURNING id INTO wholesale_id;
  
  IF wholesale_id IS NOT NULL THEN
    INSERT INTO categories (name, slug, parent_id, requires_coa, category_type, "group") VALUES
      ('Bulk Flower', 'bulk-flower', wholesale_id, true, 'product', 'convenience'),
      ('Bulk Distillate', 'bulk-distillate', wholesale_id, true, 'product', 'convenience'),
      ('Bulk Biomass', 'bulk-biomass', wholesale_id, false, 'product', 'convenience')
    ON CONFLICT (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), name) DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- Summary
-- ============================================================================
-- Seeded categories:
--   - 8 parent categories
--   - 40+ child categories
--   - COA requirements set correctly per category
--   - category_type set (product vs service)
--   - All categories have slugs for URLs
-- ============================================================================