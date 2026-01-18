-- ============================================================================
-- Marketplace Core Schema Migration
-- Good Hemp Distro - Vendor onboarding, products, orders, checkout
-- ============================================================================
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. Update Profiles Table
-- ============================================================================
-- Add display_name if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Update profile policies to allow users to read/write own profile
DROP POLICY IF EXISTS "Profiles self-access" ON profiles;
DROP POLICY IF EXISTS "Profiles self-update" ON profiles;
DROP POLICY IF EXISTS "Profiles self-insert" ON profiles;

CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 2. Create Vendors Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vendors_owner_user_id ON vendors(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);

-- Enable RLS
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vendors
CREATE POLICY "Vendors: owner can read own vendor" ON vendors
  FOR SELECT USING (auth.uid() = owner_user_id);

CREATE POLICY "Vendors: owner can create own vendor" ON vendors
  FOR INSERT WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Vendors: owner can update own vendor" ON vendors
  FOR UPDATE USING (auth.uid() = owner_user_id);

CREATE POLICY "Vendors: owner can delete own vendor" ON vendors
  FOR DELETE USING (auth.uid() = owner_user_id);

-- Trigger for updated_at
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. Update Products Table
-- ============================================================================
-- Ensure vendor_id foreign key exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'products_vendor_id_fkey' 
    AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT products_vendor_id_fkey 
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Rename is_active to active if needed (for consistency)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'products' AND column_name = 'is_active')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'products' AND column_name = 'active') THEN
    ALTER TABLE products RENAME COLUMN is_active TO active;
  END IF;
END $$;

-- Ensure active column exists
ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active) WHERE active = true;

-- Enable RLS on products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Products: public read active" ON products;
DROP POLICY IF EXISTS "Products: vendor owner CRUD" ON products;

-- RLS Policies for products
-- Public can read active products
CREATE POLICY "Products: public can read active" ON products
  FOR SELECT USING (active = true);

-- Vendor owners can CRUD their own products
CREATE POLICY "Products: vendor owner can manage" ON products
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.id = products.vendor_id 
      AND vendors.owner_user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. Update Orders Table
-- ============================================================================
-- Add vendor_id if it doesn't exist
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;

-- Rename total_amount_cents to total_cents if needed
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'orders' AND column_name = 'total_amount_cents')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'orders' AND column_name = 'total_cents') THEN
    ALTER TABLE orders RENAME COLUMN total_amount_cents TO total_cents;
  END IF;
END $$;

-- Ensure total_cents exists
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_cents INT NOT NULL DEFAULT 0 CHECK (total_cents >= 0);

-- Rename stripe_session_id to checkout_session_id for consistency
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'orders' AND column_name = 'stripe_session_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'orders' AND column_name = 'checkout_session_id') THEN
    ALTER TABLE orders RENAME COLUMN stripe_session_id TO checkout_session_id;
  END IF;
END $$;

-- Ensure checkout_session_id exists
ALTER TABLE orders ADD COLUMN IF NOT EXISTS checkout_session_id TEXT UNIQUE;

-- Rename stripe_payment_intent_id to payment_intent_id for consistency
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'orders' AND column_name = 'stripe_payment_intent_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name = 'orders' AND column_name = 'payment_intent_id') THEN
    ALTER TABLE orders RENAME COLUMN stripe_payment_intent_id TO payment_intent_id;
  END IF;
END $$;

-- Ensure payment_intent_id exists
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;

-- Add paid_at timestamp
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_checkout_session_id ON orders(checkout_session_id);

-- Enable RLS on orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Orders: user can read own" ON orders;
DROP POLICY IF EXISTS "Orders: vendor can read own vendor orders" ON orders;

-- RLS Policies for orders
-- Users can read their own orders
CREATE POLICY "Orders: user can read own" ON orders
  FOR SELECT USING (auth.uid() = user_id);

-- Vendor owners can read orders for their vendor
CREATE POLICY "Orders: vendor can read own vendor orders" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vendors 
      WHERE vendors.id = orders.vendor_id 
      AND vendors.owner_user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 5. Create Order Items Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_cents INT NOT NULL CHECK (unit_price_cents >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Enable RLS
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_items
-- Users can read order items for their orders
CREATE POLICY "Order items: user can read own order items" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND orders.user_id = auth.uid()
    )
  );

-- Vendor owners can read order items for their vendor's orders
CREATE POLICY "Order items: vendor can read own vendor order items" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders 
      JOIN vendors ON vendors.id = orders.vendor_id
      WHERE orders.id = order_items.order_id 
      AND vendors.owner_user_id = auth.uid()
    )
  );

-- ============================================================================
-- Summary
-- ============================================================================
-- Tables created/updated:
--   - profiles (updated with display_name)
--   - vendors (created with RLS)
--   - products (updated with vendor_id FK and RLS)
--   - orders (updated with vendor_id and column standardization)
--   - order_items (created with RLS)
--
-- All tables have RLS enabled with appropriate policies.
-- ============================================================================
