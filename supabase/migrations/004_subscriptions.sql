-- ============================================================================
-- Subscriptions + Packages + Affiliates Migration
-- Good Hemp Distro - Vendor/Consumer plans, subscriptions, affiliate referrals
-- ============================================================================
-- Run this in Supabase Dashboard → SQL Editor
-- Safe for fresh databases - creates all required functions and tables
-- ============================================================================

-- ============================================================================
-- 1. Create Vendor Plans Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendor_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  commission_rate NUMERIC(5,2) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
  product_limit INT,
  event_limit INT,
  perks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendor_plans_name ON vendor_plans(name);
CREATE INDEX IF NOT EXISTS idx_vendor_plans_active ON vendor_plans(is_active);

-- Enable RLS
ALTER TABLE vendor_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public can read active plans
CREATE POLICY "Vendor plans: public can read active" ON vendor_plans
  FOR SELECT USING (is_active = true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_vendor_plans_updated_at ON vendor_plans;
CREATE TRIGGER update_vendor_plans_updated_at
  BEFORE UPDATE ON vendor_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. Create Consumer Plans Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS consumer_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  monthly_points INT NOT NULL DEFAULT 0 CHECK (monthly_points >= 0),
  perks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_consumer_plans_name ON consumer_plans(name);
CREATE INDEX IF NOT EXISTS idx_consumer_plans_active ON consumer_plans(is_active);

-- Enable RLS
ALTER TABLE consumer_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Public can read active plans
CREATE POLICY "Consumer plans: public can read active" ON consumer_plans
  FOR SELECT USING (is_active = true);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_consumer_plans_updated_at ON consumer_plans;
CREATE TRIGGER update_consumer_plans_updated_at
  BEFORE UPDATE ON consumer_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. Create Subscriptions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('vendor', 'consumer')),
  plan_id UUID,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'canceled', 'past_due')),
  price_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can read their own subscriptions
CREATE POLICY "Subscriptions: user can read own" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. Update Vendors Table - Add commission_rate
-- ============================================================================
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS vendor_plan_id UUID REFERENCES vendor_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vendors_plan_id ON vendors(vendor_plan_id);

-- ============================================================================
-- 5. Update Profiles Table - Add subscription tracking
-- ============================================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_id ON profiles(active_subscription_id);

-- ============================================================================
-- 6. Create/Update Affiliates Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);

-- Enable RLS
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Affiliates: user can read own" ON affiliates;
DROP POLICY IF EXISTS "Affiliates: user can insert own" ON affiliates;
DROP POLICY IF EXISTS "Users can view their own affiliate data" ON affiliates;
DROP POLICY IF EXISTS "Users can insert their own affiliate data" ON affiliates;

-- RLS Policies: Users can read/insert their own affiliate data
CREATE POLICY "Affiliates: user can read own" ON affiliates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Affiliates: user can insert own" ON affiliates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 7. Create/Update Affiliate Referrals Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('vendor', 'consumer')),
  reward_cents INT NOT NULL DEFAULT 0 CHECK (reward_cents >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  stripe_session_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate_id ON affiliate_referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referred_user_id ON affiliate_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_status ON affiliate_referrals(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_session ON affiliate_referrals(stripe_session_id);

-- Enable RLS
ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Affiliate referrals: affiliate can read own" ON affiliate_referrals;

-- RLS Policies: Affiliates can read their own referrals
CREATE POLICY "Affiliate referrals: affiliate can read own" ON affiliate_referrals
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_affiliate_referrals_updated_at ON affiliate_referrals;
CREATE TRIGGER update_affiliate_referrals_updated_at
  BEFORE UPDATE ON affiliate_referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. Seed Vendor Plans
-- ============================================================================
INSERT INTO vendor_plans (name, price_cents, commission_rate, product_limit, event_limit, perks_json, is_active) VALUES
  ('Basic', 5000, 7.00, 25, 5, '["Basic listing","Limited events"]'::jsonb, true),
  ('Pro', 12500, 4.00, 100, NULL, '["Unlimited events","More visibility","Priority placement"]'::jsonb, true),
  ('Elite', 25000, 2.00, NULL, NULL, '["Unlimited products","Unlimited events","Wholesale access","Featured vendor"]'::jsonb, true)
ON CONFLICT (name) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  commission_rate = EXCLUDED.commission_rate,
  product_limit = EXCLUDED.product_limit,
  event_limit = EXCLUDED.event_limit,
  perks_json = EXCLUDED.perks_json,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ============================================================================
-- 9. Seed Consumer Plans
-- ============================================================================
INSERT INTO consumer_plans (name, price_cents, monthly_points, perks_json, is_active) VALUES
  ('Basic', 599, 50, '["Basic community access","Loyalty points"]'::jsonb, true),
  ('Plus', 1299, 150, '["More points","Early product alerts","Special discounts"]'::jsonb, true),
  ('Premium', 2399, 300, '["Premium points","Discounted events","DM vendors","Featured customer"]'::jsonb, true)
ON CONFLICT (name) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  monthly_points = EXCLUDED.monthly_points,
  perks_json = EXCLUDED.perks_json,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ============================================================================
-- Summary
-- ============================================================================
-- Tables created/updated:
--   - vendor_plans (created with RLS)
--   - consumer_plans (created with RLS)
--   - subscriptions (created with RLS)
--   - affiliates (created/updated with RLS)
--   - affiliate_referrals (created/updated with RLS)
--   - vendors (updated with commission_rate and vendor_plan_id)
--   - profiles (updated with active_subscription_id)
--
-- Plans seeded:
--   - Vendor: Basic ($50), Pro ($125), Elite ($250)
--   - Consumer: Basic ($5.99), Plus ($12.99), Premium ($23.99)
-- ============================================================================
