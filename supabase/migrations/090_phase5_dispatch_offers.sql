-- Phase 5A: auto dispatch offers (email-first)

CREATE TABLE IF NOT EXISTS public.driver_presence (
  driver_id UUID PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT false,
  notify_offline BOOLEAN NOT NULL DEFAULT true,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  location_updated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.delivery_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'declined', 'expired', 'cancelled')),
  offered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  offer_rank INT NOT NULL DEFAULT 1,
  accept_token_hash TEXT NOT NULL,
  CONSTRAINT delivery_offers_delivery_driver_unique UNIQUE (delivery_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_offers_delivery_id ON public.delivery_offers(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_offers_driver_id ON public.delivery_offers(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_offers_status_expires_at ON public.delivery_offers(status, expires_at);

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offering_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offer_batch INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickup_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS pickup_lng DOUBLE PRECISION;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.deliveries'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%'
    AND pg_get_constraintdef(c.oid) ILIKE '%pending%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.deliveries DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE public.deliveries DROP CONSTRAINT IF EXISTS deliveries_status_check;

  ALTER TABLE public.deliveries
    ADD CONSTRAINT deliveries_status_check
    CHECK (status IN ('pending', 'offering', 'assigned', 'picked_up', 'delivered', 'cancelled'));
END $$;

ALTER TABLE public.driver_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Driver presence: driver read own" ON public.driver_presence;
CREATE POLICY "Driver presence: driver read own" ON public.driver_presence
  FOR SELECT USING (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Driver presence: driver upsert own" ON public.driver_presence;
CREATE POLICY "Driver presence: driver upsert own" ON public.driver_presence
  FOR INSERT WITH CHECK (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Driver presence: driver update own" ON public.driver_presence;
CREATE POLICY "Driver presence: driver update own" ON public.driver_presence
  FOR UPDATE USING (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Delivery offers: driver read own" ON public.delivery_offers;
CREATE POLICY "Delivery offers: driver read own" ON public.delivery_offers
  FOR SELECT USING (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Delivery offers: driver respond own" ON public.delivery_offers;
CREATE POLICY "Delivery offers: driver respond own" ON public.delivery_offers
  FOR UPDATE USING (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
    AND status IN ('accepted', 'declined')
  );

DROP TRIGGER IF EXISTS update_driver_presence_updated_at ON public.driver_presence;
CREATE TRIGGER update_driver_presence_updated_at
  BEFORE UPDATE ON public.driver_presence
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
