-- ============================================================================
-- Vendor subscription tracking + expanded subscription statuses
-- ============================================================================

-- Expand subscription status enum (check constraint)
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('pending', 'active', 'trialing', 'past_due', 'canceled', 'unpaid'));

-- Vendor subscription fields
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

ALTER TABLE vendors DROP CONSTRAINT IF EXISTS vendors_subscription_status_check;
ALTER TABLE vendors ADD CONSTRAINT vendors_subscription_status_check
  CHECK (
    subscription_status IS NULL
    OR subscription_status IN ('pending', 'active', 'trialing', 'past_due', 'canceled', 'unpaid')
  );

CREATE INDEX IF NOT EXISTS idx_vendors_subscription_status ON vendors(subscription_status);
CREATE INDEX IF NOT EXISTS idx_vendors_stripe_subscription_id ON vendors(stripe_subscription_id);
