-- Phase 4B: Driver Stripe Connect account storage
-- Canonical paid-to entity: public.drivers (approved/suspended driver records)

ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS stripe_account_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS charges_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS connect_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_drivers_stripe_account_id
  ON public.drivers(stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- Driver can read own connect fields via existing "Drivers: user can read own" SELECT policy.
-- Allow owner to update own record for connect details (API writes under user session).
DROP POLICY IF EXISTS "Drivers: user can update own" ON public.drivers;
CREATE POLICY "Drivers: user can update own" ON public.drivers
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
