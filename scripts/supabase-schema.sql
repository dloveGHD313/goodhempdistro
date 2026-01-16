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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  featured BOOLEAN NOT NULL DEFAULT false,
  image_url TEXT,
  vendor_id UUID,
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
-- Profiles (for age verification and roles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  age_verified BOOLEAN NOT NULL DEFAULT false,
  role TEXT NOT NULL DEFAULT 'consumer' CHECK (role IN ('consumer','vendor','admin')),
  loyalty_points INT NOT NULL DEFAULT 0,
  vendor_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles self-access" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles self-update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
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
-- 6. Vendor Packages (Subscription Tiers for Vendors)
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  commission_percent NUMERIC(5,2) NOT NULL CHECK (commission_percent >= 0 AND commission_percent <= 100),
  max_products INT,
  featured_vendor BOOLEAN NOT NULL DEFAULT false,
  wholesale_access BOOLEAN NOT NULL DEFAULT false,
  event_discount BOOLEAN NOT NULL DEFAULT false,
  coa_discount BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_packages_name ON vendor_packages(name);

-- ============================================================================
-- 7. Consumer Packages (Subscription Tiers for Consumers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS consumer_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  monthly_loyalty_points INT NOT NULL DEFAULT 0,
  event_discounts BOOLEAN NOT NULL DEFAULT false,
  vendor_dm_access BOOLEAN NOT NULL DEFAULT false,
  early_product_alerts BOOLEAN NOT NULL DEFAULT false,
  featured_customer BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consumer_packages_name ON consumer_packages(name);

-- ============================================================================
-- 8. Affiliates (Referral tracking for users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('consumer','vendor')),
  affiliate_code TEXT NOT NULL UNIQUE,
  reward_cents INT NOT NULL DEFAULT 0 CHECK (reward_cents >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(affiliate_code);

ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own affiliate data" ON affiliates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own affiliate data" ON affiliates FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 9. Affiliate Referrals (Track who referred whom)
-- ============================================================================
CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate_id ON affiliate_referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referred_user ON affiliate_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_session ON affiliate_referrals(stripe_session_id);

ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates can view their referrals" ON affiliate_referrals FOR SELECT USING (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);

-- ============================================================================
-- RLS Policies for Packages (Public read access)
-- ============================================================================
ALTER TABLE vendor_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on vendor_packages" ON vendor_packages FOR SELECT USING (true);
CREATE POLICY "Admin can manage vendor_packages" ON vendor_packages FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE consumer_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on consumer_packages" ON consumer_packages FOR SELECT USING (true);
CREATE POLICY "Admin can manage consumer_packages" ON consumer_packages FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================================
-- Done! Now run: npm run seed:supabase
-- ============================================================================
