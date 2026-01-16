-- ============================================================================
-- Supabase Table Schemas for Good Hemp Distro
-- ============================================================================
-- Run this in Supabase Dashboard → SQL Editor before running the seed script
-- ============================================================================

-- 1. Navigation Links Table
-- Stores site navigation menu items
-- ============================================================================
CREATE TABLE IF NOT EXISTS navigation (
  id BIGINT PRIMARY KEY,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  "order" INT NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for ordering
CREATE INDEX IF NOT EXISTS idx_navigation_order ON navigation("order");

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_navigation_updated_at
  BEFORE UPDATE ON navigation
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. Site Configuration Table
-- Stores key-value pairs for site settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS site_config (
  id BIGINT PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'string',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for key lookups
CREATE INDEX IF NOT EXISTS idx_site_config_key ON site_config(key);

CREATE TRIGGER update_site_config_updated_at
  BEFORE UPDATE ON site_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. Design Settings Table
-- Stores design and theme preferences
-- ============================================================================
CREATE TABLE IF NOT EXISTS design_settings (
  id BIGINT PRIMARY KEY,
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for key lookups
CREATE INDEX IF NOT EXISTS idx_design_settings_key ON design_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_design_settings_category ON design_settings(category);

CREATE TRIGGER update_design_settings_updated_at
  BEFORE UPDATE ON design_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. Products Table (Optional)
-- Stores product catalog
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  category TEXT,
  in_stock BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  vendor_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_products_in_stock ON products(in_stock) WHERE in_stock = true;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. Orders Table (if not exists)
-- Stores customer orders
-- ============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  total_amount_cents INT NOT NULL CHECK (total_amount_cents >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Navigation: Public read access
ALTER TABLE navigation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on navigation"
  ON navigation FOR SELECT
  USING (visible = true);

CREATE POLICY "Allow authenticated insert/update on navigation"
  ON navigation FOR ALL
  USING (auth.role() = 'authenticated');

-- Site Config: Public read access
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on site_config"
  ON site_config FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert/update on site_config"
  ON site_config FOR ALL
  USING (auth.role() = 'authenticated');

-- Design Settings: Public read access
ALTER TABLE design_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on design_settings"
  ON design_settings FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated insert/update on design_settings"
  ON design_settings FOR ALL
  USING (auth.role() = 'authenticated');

-- Products: Public read access for in-stock items
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on products"
  ON products FOR SELECT
  USING (in_stock = true);

CREATE POLICY "Allow authenticated insert/update on products"
  ON products FOR ALL
  USING (auth.role() = 'authenticated');

-- Orders: User can only see their own orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Sample Queries (for testing)
-- ============================================================================

-- View all navigation links
-- SELECT * FROM navigation ORDER BY "order";

-- View all site config
-- SELECT * FROM site_config;

-- View featured products
-- SELECT * FROM products WHERE featured = true AND in_stock = true;

-- View orders by status
-- SELECT * FROM orders WHERE status = 'paid';

-- ============================================================================
-- Done! Now run: npm run seed:supabase
-- ============================================================================
