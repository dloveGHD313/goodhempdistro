-- Platform fee rules and order_items fee columns
-- Fee depends on vendor plan/tier and item_type; persisted on order_items when order is paid

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
CREATE INDEX IF NOT EXISTS idx_platform_fee_rules_active ON platform_fee_rules(active) WHERE active = true;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS platform_fee_cents INT NULL CHECK (platform_fee_cents IS NULL OR platform_fee_cents >= 0);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vendor_net_cents INT NULL;

-- Seed default rules: 5% (500 bps) for product/service, 3% for event_ticket, 4% for vendor_slot
INSERT INTO platform_fee_rules (vendor_plan_type, item_type, fee_bps, active)
VALUES
  ('default', 'product', 500, true),
  ('default', 'service', 500, true),
  ('default', 'event_ticket', 300, true),
  ('default', 'vendor_slot', 400, true),
  ('starter', 'product', 500, true),
  ('starter', 'service', 500, true),
  ('starter', 'event_ticket', 300, true),
  ('starter', 'vendor_slot', 400, true),
  ('mid', 'product', 400, true),
  ('mid', 'service', 400, true),
  ('mid', 'event_ticket', 250, true),
  ('mid', 'vendor_slot', 350, true),
  ('top', 'product', 300, true),
  ('top', 'service', 300, true),
  ('top', 'event_ticket', 200, true),
  ('top', 'vendor_slot', 250, true)
ON CONFLICT (vendor_plan_type, item_type) DO NOTHING;

COMMENT ON TABLE platform_fee_rules IS 'Platform take-rate per vendor plan and item type (fee_bps = basis points, 100 = 1%)';
COMMENT ON COLUMN order_items.platform_fee_cents IS 'Platform fee for this line (set when order paid)';
COMMENT ON COLUMN order_items.vendor_net_cents IS 'Vendor net for this line (line_total_cents - platform_fee_cents)';
