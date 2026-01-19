-- ============================================================================
-- Events + Ticketing Migration
-- ============================================================================

-- 1. Create Events Table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  tickets_sold INTEGER NOT NULL DEFAULT 0 CHECK (tickets_sold >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for events
CREATE INDEX IF NOT EXISTS idx_events_vendor_id ON events(vendor_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for events
DROP POLICY IF EXISTS "Events: public can read published" ON events;
DROP POLICY IF EXISTS "Events: vendor can CRUD own" ON events;
DROP POLICY IF EXISTS "Events: admin can manage all" ON events;

CREATE POLICY "Events: public can read published" ON events
  FOR SELECT USING (status = 'published');

CREATE POLICY "Events: vendor can CRUD own" ON events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_user_id = auth.uid())
  );

CREATE POLICY "Events: admin can manage all" ON events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Create Event Ticket Types Table
CREATE TABLE IF NOT EXISTS event_ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  quantity INTEGER CHECK (quantity IS NULL OR quantity > 0),
  sold INTEGER NOT NULL DEFAULT 0 CHECK (sold >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for event_ticket_types
CREATE INDEX IF NOT EXISTS idx_event_ticket_types_event_id ON event_ticket_types(event_id);

-- Enable RLS
ALTER TABLE event_ticket_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_ticket_types
DROP POLICY IF EXISTS "Ticket types: public can read for published events" ON event_ticket_types;
DROP POLICY IF EXISTS "Ticket types: vendor can manage for own events" ON event_ticket_types;
DROP POLICY IF EXISTS "Ticket types: admin can manage all" ON event_ticket_types;

CREATE POLICY "Ticket types: public can read for published events" ON event_ticket_types
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND status = 'published')
  );

CREATE POLICY "Ticket types: vendor can manage for own events" ON event_ticket_types
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN vendors v ON v.id = e.vendor_id
      WHERE e.id = event_id AND v.owner_user_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM events e
      JOIN vendors v ON v.id = e.vendor_id
      WHERE e.id = event_id AND v.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Ticket types: admin can manage all" ON event_ticket_types
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_event_ticket_types_updated_at ON event_ticket_types;
CREATE TRIGGER update_event_ticket_types_updated_at
  BEFORE UPDATE ON event_ticket_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 3. Create Event Orders Table
CREATE TABLE IF NOT EXISTS event_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  stripe_session_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for event_orders
CREATE INDEX IF NOT EXISTS idx_event_orders_user_id ON event_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_event_orders_event_id ON event_orders(event_id);
CREATE INDEX IF NOT EXISTS idx_event_orders_stripe_session_id ON event_orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_event_orders_status ON event_orders(status);

-- Enable RLS
ALTER TABLE event_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_orders
DROP POLICY IF EXISTS "Event orders: user can read own" ON event_orders;
DROP POLICY IF EXISTS "Event orders: vendor can read for own events" ON event_orders;
DROP POLICY IF EXISTS "Event orders: admin can read all" ON event_orders;

CREATE POLICY "Event orders: user can read own" ON event_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Event orders: vendor can read for own events" ON event_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN vendors v ON v.id = e.vendor_id
      WHERE e.id = event_id AND v.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Event orders: admin can read all" ON event_orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_event_orders_updated_at ON event_orders;
CREATE TRIGGER update_event_orders_updated_at
  BEFORE UPDATE ON event_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. Create Event Order Items Table
CREATE TABLE IF NOT EXISTS event_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_order_id UUID NOT NULL REFERENCES event_orders(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES event_ticket_types(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for event_order_items
CREATE INDEX IF NOT EXISTS idx_event_order_items_order_id ON event_order_items(event_order_id);
CREATE INDEX IF NOT EXISTS idx_event_order_items_ticket_type_id ON event_order_items(ticket_type_id);

-- Enable RLS
ALTER TABLE event_order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_order_items (same visibility as parent order)
DROP POLICY IF EXISTS "Event order items: user can read via own order" ON event_order_items;
DROP POLICY IF EXISTS "Event order items: vendor can read via own events" ON event_order_items;
DROP POLICY IF EXISTS "Event order items: admin can read all" ON event_order_items;

CREATE POLICY "Event order items: user can read via own order" ON event_order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM event_orders WHERE id = event_order_id AND user_id = auth.uid())
  );

CREATE POLICY "Event order items: vendor can read via own events" ON event_order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM event_orders eo
      JOIN events e ON e.id = eo.event_id
      JOIN vendors v ON v.id = e.vendor_id
      WHERE eo.id = event_order_id AND v.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Event order items: admin can read all" ON event_order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
