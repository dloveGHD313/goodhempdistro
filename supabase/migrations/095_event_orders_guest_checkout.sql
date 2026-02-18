-- Phase 3C: Guest checkout for event tickets
-- Allow event_orders without a user_id when purchaser_email is provided.

-- Add purchaser_email for guest orders
ALTER TABLE event_orders
  ADD COLUMN IF NOT EXISTS purchaser_email TEXT;

-- Allow user_id to be NULL (guest orders)
ALTER TABLE event_orders
  ALTER COLUMN user_id DROP NOT NULL;

-- Ensure at least one of user_id or purchaser_email is set
ALTER TABLE event_orders
  DROP CONSTRAINT IF EXISTS event_orders_user_or_email;

ALTER TABLE event_orders
  ADD CONSTRAINT event_orders_user_or_email CHECK (
    user_id IS NOT NULL
    OR (purchaser_email IS NOT NULL AND trim(purchaser_email) <> '')
  );

-- Optional: index for lookups by purchaser_email (e.g. support)
CREATE INDEX IF NOT EXISTS idx_event_orders_purchaser_email
  ON event_orders (purchaser_email)
  WHERE purchaser_email IS NOT NULL;
