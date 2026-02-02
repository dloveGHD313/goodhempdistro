-- Orders foundation: currency, order_items extensibility, RLS insert + admin read
-- Idempotent; safe to run on existing orders/order_items

-- orders: add currency
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'usd';

-- order_items: add item_type, item_id, vendor_user_id, line_total_cents, fulfilled_at
-- Keep product_id for backward compatibility; item_type/item_id support product|service|event_ticket|vendor_slot
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_type TEXT NOT NULL DEFAULT 'product'
  CHECK (item_type IN ('product', 'service', 'event_ticket', 'vendor_slot'));
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_id UUID NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS vendor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS line_total_cents INT NULL CHECK (line_total_cents IS NULL OR line_total_cents >= 0);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ NULL;

-- Make product_id nullable for non-product item types
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'product_id') THEN
    ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;
  END IF;
END $$;

-- Backfill line_total_cents and item_id where missing
UPDATE order_items
SET line_total_cents = quantity * unit_price_cents,
    item_id = product_id
WHERE line_total_cents IS NULL AND quantity IS NOT NULL AND unit_price_cents IS NOT NULL;

UPDATE order_items
SET item_type = 'product'
WHERE item_type IS NULL OR item_type = '';

-- Backfill vendor_user_id from products -> vendors for product items
UPDATE order_items oi
SET vendor_user_id = v.owner_user_id
FROM products p
JOIN vendors v ON v.id = p.vendor_id
WHERE oi.product_id = p.id AND oi.vendor_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_vendor_user_id ON order_items(vendor_user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item_type ON order_items(item_type);

-- RLS: allow buyer to insert own orders
DROP POLICY IF EXISTS "Orders: user can insert own" ON orders;
CREATE POLICY "Orders: user can insert own" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS: allow buyer to insert order_items for own order
DROP POLICY IF EXISTS "Order items: user can insert for own order" ON order_items;
CREATE POLICY "Order items: user can insert for own order" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

-- RLS: admin can read all orders (via admin_users table)
DROP POLICY IF EXISTS "Orders: admin can read all" ON orders;
CREATE POLICY "Orders: admin can read all" ON orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Order items: admin can read all" ON order_items;
CREATE POLICY "Order items: admin can read all" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

COMMENT ON TABLE orders IS 'Marketplace orders; Stripe checkout_session_id links to Stripe session';
COMMENT ON TABLE order_items IS 'Line items: product|service|event_ticket|vendor_slot; vendor_user_id for vendor payouts';
