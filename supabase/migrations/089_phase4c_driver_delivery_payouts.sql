-- Phase 4C: Driver delivery confirmation + payout release

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS delivery_type TEXT NOT NULL DEFAULT 'retail',
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_by TEXT,
  ADD COLUMN IF NOT EXISTS proof_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS receiver_name TEXT,
  ADD COLUMN IF NOT EXISTS bol_reference TEXT,
  ADD COLUMN IF NOT EXISTS payout_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS driver_payout_cents INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS driver_stripe_transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS payout_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_error TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deliveries_delivery_type_check'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT deliveries_delivery_type_check
      CHECK (delivery_type IN ('retail', 'b2b'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deliveries_confirmed_by_check'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT deliveries_confirmed_by_check
      CHECK (confirmed_by IN ('driver', 'receiver', 'customer', 'admin', 'system'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deliveries_payout_status_check'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT deliveries_payout_status_check
      CHECK (payout_status IN ('unpaid', 'eligible', 'paid', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'deliveries_driver_payout_cents_check'
      AND conrelid = 'public.deliveries'::regclass
  ) THEN
    ALTER TABLE public.deliveries
      ADD CONSTRAINT deliveries_driver_payout_cents_check
      CHECK (driver_payout_cents >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.driver_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  stripe_transfer_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT driver_payouts_delivery_id_unique UNIQUE (delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_deliveries_payout_status ON public.deliveries(payout_status);
CREATE INDEX IF NOT EXISTS idx_driver_payouts_driver_id ON public.driver_payouts(driver_id);

ALTER TABLE public.driver_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deliveries: driver can update own confirmation" ON public.deliveries;
CREATE POLICY "Deliveries: driver can update own confirmation" ON public.deliveries
  FOR UPDATE
  USING (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Driver payouts: driver can read own" ON public.driver_payouts;
CREATE POLICY "Driver payouts: driver can read own" ON public.driver_payouts
  FOR SELECT USING (
    driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Driver payouts: service and admin can insert" ON public.driver_payouts;
CREATE POLICY "Driver payouts: service and admin can insert" ON public.driver_payouts
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Driver payouts: service and admin can update" ON public.driver_payouts;
CREATE POLICY "Driver payouts: service and admin can update" ON public.driver_payouts
  FOR UPDATE USING (
    auth.role() = 'service_role'
    OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

DROP TRIGGER IF EXISTS update_driver_payouts_updated_at ON public.driver_payouts;
CREATE TRIGGER update_driver_payouts_updated_at
  BEFORE UPDATE ON public.driver_payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
