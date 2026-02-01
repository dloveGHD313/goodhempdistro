-- Vendor Stripe Connect accounts (Express) for payouts
-- Used for vendor referral payouts and (optional) sales net payouts

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
CREATE POLICY "Vendor connect: owner can read own" ON vendor_connect_accounts
  FOR SELECT USING (auth.uid() = user_id);

-- Inserts/updates only via API (service role or backend)
DROP POLICY IF EXISTS "Vendor connect: owner can insert own" ON vendor_connect_accounts;
CREATE POLICY "Vendor connect: owner can insert own" ON vendor_connect_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Vendor connect: owner can update own" ON vendor_connect_accounts;
CREATE POLICY "Vendor connect: owner can update own" ON vendor_connect_accounts
  FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON TABLE vendor_connect_accounts IS 'Stripe Connect Express accounts for vendors (payouts)';
