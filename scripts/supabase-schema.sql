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
  role TEXT NOT NULL DEFAULT 'consumer' CHECK (role IN ('consumer','vendor','affiliate','admin')),
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
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  stripe_price_id TEXT,
  monthly_price_cents INT NOT NULL CHECK (monthly_price_cents >= 0),
  commission_bps INT NOT NULL CHECK (commission_bps >= 0),
  product_limit INT,
  event_limit INT,
  featured BOOLEAN NOT NULL DEFAULT false,
  wholesale_access BOOLEAN NOT NULL DEFAULT false,
  perks JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_packages_slug ON vendor_packages(slug);
CREATE INDEX IF NOT EXISTS idx_vendor_packages_active ON vendor_packages(is_active);
CREATE TRIGGER update_vendor_packages_updated_at
  BEFORE UPDATE ON vendor_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 7. Consumer Packages (Subscription Tiers for Consumers)
-- ============================================================================
CREATE TABLE IF NOT EXISTS consumer_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  stripe_price_id TEXT,
  monthly_price_cents INT NOT NULL CHECK (monthly_price_cents >= 0),
  perks JSONB NOT NULL DEFAULT '[]'::jsonb,
  loyalty_points_multiplier INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consumer_packages_slug ON consumer_packages(slug);
CREATE INDEX IF NOT EXISTS idx_consumer_packages_active ON consumer_packages(is_active);
CREATE TRIGGER update_consumer_packages_updated_at
  BEFORE UPDATE ON consumer_packages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. Affiliates (Referral tracking for users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('consumer','vendor','affiliate')),
  affiliate_code TEXT NOT NULL UNIQUE,
  reward_cents INT NOT NULL DEFAULT 0 CHECK (reward_cents >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. Subscriptions (Stripe subscriptions for consumer/vendor plans)
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_type TEXT NOT NULL CHECK (package_type IN ('consumer','vendor')),
  package_slug TEXT,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  price_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','canceled','trialing','incomplete','incomplete_expired','unpaid')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_type ON subscriptions(package_type);

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Admin can manage subscriptions"
  ON subscriptions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

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
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  reward_cents INT NOT NULL DEFAULT 0 CHECK (reward_cents >= 0),
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
-- 10. Affiliate Payouts (Payout ledger for pending/paid rewards)
-- ============================================================================
CREATE TABLE IF NOT EXISTS affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate_id ON affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_status ON affiliate_payouts(status);

CREATE TRIGGER update_affiliate_payouts_updated_at
  BEFORE UPDATE ON affiliate_payouts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates can view their payouts" ON affiliate_payouts FOR SELECT USING (
  affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
);
CREATE POLICY "Admin can manage all payouts" ON affiliate_payouts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================================
-- RLS Policies for Packages (Public read access)
-- ============================================================================
ALTER TABLE vendor_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on active vendor_packages" ON vendor_packages
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage vendor_packages" ON vendor_packages FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE consumer_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on active consumer_packages" ON consumer_packages
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admin can manage consumer_packages" ON consumer_packages FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================================
-- Seed Data: Packages
-- ============================================================================
INSERT INTO vendor_packages (
  slug,
  name,
  monthly_price_cents,
  commission_bps,
  product_limit,
  event_limit,
  featured,
  wholesale_access,
  perks,
  is_active,
  sort_order
) VALUES
  ('basic', 'Basic', 5000, 700, 25, 5, false, false, '["Starter listing","Limited events","Basic analytics"]'::jsonb, true, 1),
  ('plus', 'Plus', 12500, 400, 100, NULL, false, false, '["Unlimited events","More visibility","Priority placement"]'::jsonb, true, 2),
  ('premium', 'Premium', 25000, 200, NULL, NULL, true, true, '["Featured vendor","Discounted Good Hemp events","Discounted COAs","Wholesale access"]'::jsonb, true, 3)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  commission_bps = EXCLUDED.commission_bps,
  product_limit = EXCLUDED.product_limit,
  event_limit = EXCLUDED.event_limit,
  featured = EXCLUDED.featured,
  wholesale_access = EXCLUDED.wholesale_access,
  perks = EXCLUDED.perks,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

INSERT INTO consumer_packages (
  slug,
  name,
  monthly_price_cents,
  perks,
  loyalty_points_multiplier,
  is_active,
  sort_order
) VALUES
  ('starter', 'Starter', 599, '["Basic community access","Loyalty points"]'::jsonb, 1, true, 1),
  ('plus', 'Plus', 1299, '["More points","Early product alerts","Special discounts"]'::jsonb, 2, true, 2),
  ('vip', 'VIP', 2399, '["Discounted Good Hemp events","DM vendors","Monthly loyalty drops","Featured customer"]'::jsonb, 3, true, 3)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  perks = EXCLUDED.perks,
  loyalty_points_multiplier = EXCLUDED.loyalty_points_multiplier,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

-- ============================================================================
-- Done! Now run: npm run seed:supabase
-- ============================================================================
