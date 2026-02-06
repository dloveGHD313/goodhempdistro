-- ============================================================================
-- Phase 7: Fulfillment method on orders + vendor order notifications
-- ============================================================================

-- orders: store fulfillment_method explicitly
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS fulfillment_method TEXT NULL
  CHECK (fulfillment_method IS NULL OR fulfillment_method IN ('pickup', 'delivery', 'shipping'));

-- Backfill: delivery_selected true => 'delivery', else 'pickup'
UPDATE public.orders
SET fulfillment_method = CASE WHEN delivery_selected = true THEN 'delivery' ELSE 'pickup' END
WHERE fulfillment_method IS NULL;

COMMENT ON COLUMN public.orders.fulfillment_method IS 'pickup | delivery | shipping';

-- Vendor notifications (simple: vendor_id, message, read)
CREATE TABLE IF NOT EXISTS public.order_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_notifications_vendor_id ON public.order_notifications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_order_notifications_read_at ON public.order_notifications(vendor_id, read_at) WHERE read_at IS NULL;

ALTER TABLE public.order_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_notifications: vendor read own" ON public.order_notifications;
CREATE POLICY "order_notifications: vendor read own" ON public.order_notifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = order_notifications.vendor_id AND v.owner_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "order_notifications: vendor update own (mark read)" ON public.order_notifications;
CREATE POLICY "order_notifications: vendor update own (mark read)" ON public.order_notifications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = order_notifications.vendor_id AND v.owner_user_id = auth.uid())
  );

-- Insert from service role / backend only (no policy for INSERT; use admin client in API)
