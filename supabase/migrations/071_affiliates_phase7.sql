-- Phase 7: Affiliates — ledger, payouts, reward rules, Stripe Connect for payouts
-- Creates affiliates + affiliate_referrals if missing (from 004), then Phase 7 extensions.

-- ========== Ensure base tables exist (idempotent; safe if 004 was not run) ==========
CREATE TABLE IF NOT EXISTS public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);

ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Affiliates: user can read own" ON affiliates;
CREATE POLICY "Affiliates: user can read own" ON affiliates
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Affiliates: user can insert own" ON affiliates;
CREATE POLICY "Affiliates: user can insert own" ON affiliates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('vendor', 'consumer')),
  reward_cents INT NOT NULL DEFAULT 0 CHECK (reward_cents >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  stripe_session_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate_id ON affiliate_referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_referred_user_id ON affiliate_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_status ON affiliate_referrals(status);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_session ON affiliate_referrals(stripe_session_id);

ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Affiliate referrals: affiliate can read own" ON affiliate_referrals;
CREATE POLICY "Affiliate referrals: affiliate can read own" ON affiliate_referrals
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
  );

-- ========== Phase 7 extensions ==========
-- affiliates: add Stripe Connect for payouts
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS stripe_account_id TEXT NULL UNIQUE;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Affiliate reward rules by item_type (rate_bps = basis points per order line)
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

-- Affiliate ledger: earnings per order/attribution (pending -> available -> paid via payout)
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
CREATE POLICY "Affiliate ledger: affiliate can read own" ON affiliate_ledger
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Affiliate ledger: admin can read all" ON affiliate_ledger;
CREATE POLICY "Affiliate ledger: admin can read all" ON affiliate_ledger
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Affiliate ledger: admin can update for payout" ON affiliate_ledger;
CREATE POLICY "Affiliate ledger: admin can update for payout" ON affiliate_ledger
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

-- Affiliate payouts: request -> admin approve -> Stripe Transfer
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
CREATE POLICY "Affiliate payouts: affiliate can read own" ON affiliate_payouts
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM affiliates WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Affiliate payouts: admin can read all" ON affiliate_payouts;
CREATE POLICY "Affiliate payouts: admin can read all" ON affiliate_payouts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Affiliate payouts: admin can update" ON affiliate_payouts;
CREATE POLICY "Affiliate payouts: admin can update" ON affiliate_payouts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

-- Link ledger entry to payout when paid (set on admin approve)
ALTER TABLE affiliate_ledger ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES affiliate_payouts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_affiliate_ledger_payout_id ON affiliate_ledger(payout_id);

-- Unique referred_user_id per affiliate (one referral per referred user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate_referred_unique
  ON affiliate_referrals(affiliate_id, referred_user_id)
  WHERE referred_user_id IS NOT NULL;

COMMENT ON TABLE affiliate_ledger IS 'Affiliate earnings per order; status available -> paid via affiliate_payouts';
COMMENT ON TABLE affiliate_payouts IS 'Payout requests; admin approves and triggers Stripe Transfer to affiliate stripe_account_id';
