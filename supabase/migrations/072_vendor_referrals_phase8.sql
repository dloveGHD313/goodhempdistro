-- Phase 8: Vendor referrals — referrers, referrals, ledger, payouts (Stripe Transfer to vendor Connect)
-- One referral code per vendor; reward on signup + optional first_sale.

-- Store referral code on application so we can attribute when admin approves
ALTER TABLE vendor_applications ADD COLUMN IF NOT EXISTS referral_code TEXT NULL;

-- ========== Vendor referrers: one code per vendor ==========
CREATE TABLE IF NOT EXISTS public.vendor_referrers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_referrers_vendor_id ON vendor_referrers(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_referrers_code ON vendor_referrers(referral_code);

ALTER TABLE vendor_referrers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendor referrers: vendor can read own" ON vendor_referrers;
CREATE POLICY "Vendor referrers: vendor can read own" ON vendor_referrers
  FOR SELECT USING (
    vendor_id IN (SELECT id FROM vendors WHERE owner_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Vendor referrers: vendor can insert own" ON vendor_referrers;
CREATE POLICY "Vendor referrers: vendor can insert own" ON vendor_referrers
  FOR INSERT WITH CHECK (
    vendor_id IN (SELECT id FROM vendors WHERE owner_user_id = auth.uid())
  );

-- ========== Vendor referral events (signup, first_sale) ==========
CREATE TABLE IF NOT EXISTS public.vendor_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  referred_vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('signup', 'first_sale')),
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  reward_cents INT NOT NULL DEFAULT 0 CHECK (reward_cents >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_referrals_referrer ON vendor_referrals(referrer_vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_referrals_referred ON vendor_referrals(referred_vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_referrals_event ON vendor_referrals(event_type);

ALTER TABLE vendor_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendor referrals: referrer can read own" ON vendor_referrals;
CREATE POLICY "Vendor referrals: referrer can read own" ON vendor_referrals
  FOR SELECT USING (
    referrer_vendor_id IN (SELECT id FROM vendors WHERE owner_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Vendor referrals: admin can read all" ON vendor_referrals;
CREATE POLICY "Vendor referrals: admin can read all" ON vendor_referrals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

-- ========== Reward rules by event type ==========
CREATE TABLE IF NOT EXISTS public.vendor_referral_reward_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL UNIQUE CHECK (event_type IN ('signup', 'first_sale')),
  reward_cents INT NOT NULL DEFAULT 0 CHECK (reward_cents >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO vendor_referral_reward_rules (event_type, reward_cents, active)
VALUES ('signup', 1000, true), ('first_sale', 2000, true)
ON CONFLICT (event_type) DO NOTHING;

-- ========== Ledger: earnings per referral (available -> paid via payout) ==========
CREATE TABLE IF NOT EXISTS public.vendor_referral_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'paid')),
  vendor_referral_id UUID REFERENCES vendor_referrals(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_referral_ledger_referrer ON vendor_referral_ledger(referrer_vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_referral_ledger_status ON vendor_referral_ledger(status);

ALTER TABLE vendor_referral_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendor referral ledger: vendor can read own" ON vendor_referral_ledger;
CREATE POLICY "Vendor referral ledger: vendor can read own" ON vendor_referral_ledger
  FOR SELECT USING (
    referrer_vendor_id IN (SELECT id FROM vendors WHERE owner_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Vendor referral ledger: admin can read all" ON vendor_referral_ledger;
CREATE POLICY "Vendor referral ledger: admin can read all" ON vendor_referral_ledger
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Vendor referral ledger: admin can update for payout" ON vendor_referral_ledger;
CREATE POLICY "Vendor referral ledger: admin can update for payout" ON vendor_referral_ledger
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

-- ========== Payouts: request -> admin approve -> Stripe Transfer to vendor Connect ==========
CREATE TABLE IF NOT EXISTS public.vendor_referral_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  stripe_transfer_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'paid', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendor_referral_payouts_referrer ON vendor_referral_payouts(referrer_vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_referral_payouts_status ON vendor_referral_payouts(status);

ALTER TABLE vendor_referral_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendor referral payouts: vendor can read own" ON vendor_referral_payouts;
CREATE POLICY "Vendor referral payouts: vendor can read own" ON vendor_referral_payouts
  FOR SELECT USING (
    referrer_vendor_id IN (SELECT id FROM vendors WHERE owner_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Vendor referral payouts: admin can read all" ON vendor_referral_payouts;
CREATE POLICY "Vendor referral payouts: admin can read all" ON vendor_referral_payouts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Vendor referral payouts: admin can update" ON vendor_referral_payouts;
CREATE POLICY "Vendor referral payouts: admin can update" ON vendor_referral_payouts
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

-- Link ledger to payout when paid
ALTER TABLE vendor_referral_ledger ADD COLUMN IF NOT EXISTS payout_id UUID REFERENCES vendor_referral_payouts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_vendor_referral_ledger_payout_id ON vendor_referral_ledger(payout_id);

COMMENT ON TABLE vendor_referrers IS 'One referral code per vendor for referring other vendors';
COMMENT ON TABLE vendor_referrals IS 'Referral events: signup, first_sale';
COMMENT ON TABLE vendor_referral_ledger IS 'Earnings per referral; status available -> paid via vendor_referral_payouts';
COMMENT ON TABLE vendor_referral_payouts IS 'Payout requests; admin approves and Stripe Transfer to vendor Connect account';
