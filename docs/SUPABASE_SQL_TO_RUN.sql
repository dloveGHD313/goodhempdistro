-- =============================================================================
-- GoodHempDistro — New migrations (paste into Supabase SQL Editor)
-- Run in order: 067, 068, 069, 071 (070 fix only if 067 used profiles.is_admin)
-- =============================================================================

-- ========== 067_orders_foundation ==========
-- Orders foundation: currency, order_items extensibility, RLS insert + admin read
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'usd';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'product'
  CHECK (item_type IN ('product', 'service', 'event_ticket', 'vendor_slot'));
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_id UUID NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vendor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS line_total_cents INT NULL CHECK (line_total_cents IS NULL OR line_total_cents >= 0);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ NULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'product_id') THEN
    ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;
  END IF;
END $$;
UPDATE order_items SET line_total_cents = quantity * unit_price_cents, item_id = product_id WHERE line_total_cents IS NULL AND quantity IS NOT NULL AND unit_price_cents IS NOT NULL;
UPDATE order_items SET item_type = 'product' WHERE item_type IS NULL OR item_type = '';
UPDATE order_items oi SET vendor_user_id = v.owner_user_id FROM products p JOIN vendors v ON v.id = p.vendor_id WHERE oi.product_id = p.id AND oi.vendor_user_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_vendor_user_id ON order_items(vendor_user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item_type ON order_items(item_type);
DROP POLICY IF EXISTS "Orders: user can insert own" ON orders;
CREATE POLICY "Orders: user can insert own" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Order items: user can insert for own order" ON order_items;
CREATE POLICY "Order items: user can insert for own order" ON order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
DROP POLICY IF EXISTS "Orders: admin can read all" ON orders;
CREATE POLICY "Orders: admin can read all" ON orders FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.role = 'admin')));
DROP POLICY IF EXISTS "Order items: admin can read all" ON order_items;
CREATE POLICY "Order items: admin can read all" ON order_items FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND (profiles.is_admin = true OR profiles.role = 'admin')));

-- ========== 068_platform_fees ==========
CREATE TABLE IF NOT EXISTS public.platform_fee_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_plan_type TEXT NOT NULL DEFAULT 'default',
  item_type TEXT NOT NULL CHECK (item_type IN ('product', 'service', 'event_ticket', 'vendor_slot')),
  fee_bps INT NOT NULL DEFAULT 0 CHECK (fee_bps >= 0 AND fee_bps <= 10000),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(vendor_plan_type, item_type)
);
CREATE INDEX IF NOT EXISTS idx_platform_fee_rules_plan_type ON platform_fee_rules(vendor_plan_type);
CREATE INDEX IF NOT EXISTS idx_platform_fee_rules_item_type ON platform_fee_rules(item_type);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS platform_fee_cents INT NULL CHECK (platform_fee_cents IS NULL OR platform_fee_cents >= 0);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vendor_net_cents INT NULL;
INSERT INTO platform_fee_rules (vendor_plan_type, item_type, fee_bps, active)
VALUES ('default','product',500,true),('default','service',500,true),('default','event_ticket',300,true),('default','vendor_slot',400,true),
('starter','product',500,true),('starter','service',500,true),('starter','event_ticket',300,true),('starter','vendor_slot',400,true),
('mid','product',400,true),('mid','service',400,true),('mid','event_ticket',250,true),('mid','vendor_slot',350,true),
('top','product',300,true),('top','service',300,true),('top','event_ticket',200,true),('top','vendor_slot',250,true)
ON CONFLICT (vendor_plan_type, item_type) DO NOTHING;

-- ========== 069_vendor_connect ==========
CREATE TABLE IF NOT EXISTS public.vendor_connect_accounts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vendor_connect_stripe_account ON vendor_connect_accounts(stripe_account_id);
ALTER TABLE vendor_connect_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendor connect: owner can read own" ON vendor_connect_accounts;
CREATE POLICY "Vendor connect: owner can read own" ON vendor_connect_accounts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Vendor connect: owner can insert own" ON vendor_connect_accounts;
CREATE POLICY "Vendor connect: owner can insert own" ON vendor_connect_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Vendor connect: owner can update own" ON vendor_connect_accounts;
CREATE POLICY "Vendor connect: owner can update own" ON vendor_connect_accounts FOR UPDATE USING (auth.uid() = user_id);

-- ========== 071_affiliates_phase7 ==========
-- Phase 7: Affiliates — ledger, payouts, reward rules, Stripe Connect
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS stripe_account_id TEXT NULL UNIQUE;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
CREATE TABLE IF NOT EXISTS public.affiliate_reward_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL CHECK (item_type IN ('product', 'service', 'event_ticket', 'vendor_slot')),
  rate_bps INT NOT NULL DEFAULT 0 CHECK (rate_bps >= 0 AND rate_bps <= 10000),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(item_type)
);
INSERT INTO affiliate_reward_rules (item_type, rate_bps, active)
VALUES ('product', 200, true), ('service', 200, true), ('event_ticket', 150, true), ('vendor_slot', 150, true)
ON CONFLICT (item_type) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.affiliate_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'paid')),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_affiliate_ledger_affiliate_id ON affiliate_ledger(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_ledger_status ON affiliate_ledger(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_ledger_order_id ON affiliate_ledger(order_id);
ALTER TABLE affiliate_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Affiliate ledger: affiliate can read own" ON affiliate_ledger;
CREATE POLICY "Affiliate ledger: affiliate can read own" ON affiliate_ledger FOR SELECT USING (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Affiliate ledger: admin can read all" ON affiliate_ledger;
CREATE POLICY "Affiliate ledger: admin can read all" ON affiliate_ledger FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));
DROP POLICY IF EXISTS "Affiliate ledger: admin can update for payout" ON affiliate_ledger;
CREATE POLICY "Affiliate ledger: admin can update for payout" ON affiliate_ledger FOR UPDATE USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  stripe_transfer_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'paid', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate_id ON affiliate_payouts(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_status ON affiliate_payouts(status);
ALTER TABLE affiliate_payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Affiliate payouts: affiliate can read own" ON affiliate_payouts;
CREATE POLICY "Affiliate payouts: affiliate can read own" ON affiliate_payouts FOR SELECT USING (affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Affiliate payouts: admin can read all" ON affiliate_payouts;
CREATE POLICY "Affiliate payouts: admin can read all" ON affiliate_payouts FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));
DROP POLICY IF EXISTS "Affiliate payouts: admin can update" ON affiliate_payouts;
CREATE POLICY "Affiliate payouts: admin can update" ON affiliate_payouts FOR UPDATE USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()));
ALTER TABLE affiliate_ledger ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES affiliate_payouts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_affiliate_ledger_payout_id ON affiliate_ledger(payout_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate_referred_unique ON affiliate_referrals(affiliate_id, referred_user_id) WHERE referred_user_id IS NOT NULL;
