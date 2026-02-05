-- ============================================================================
-- Phase 5: logistics_applications, delivery_pricing, order delivery fields, drivers extensibility
-- ============================================================================

-- 1. logistics_applications (on-demand driver + provider listing applications)
CREATE TABLE IF NOT EXISTS public.logistics_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL CHECK (type IN ('provider_listing', 'on_demand_driver')),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  service_area TEXT,
  vehicle_type TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_logistics_applications_type_status ON public.logistics_applications(type, status);
CREATE INDEX IF NOT EXISTS idx_logistics_applications_created_at ON public.logistics_applications(created_at DESC);

ALTER TABLE public.logistics_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logistics_applications: anon and auth can insert" ON public.logistics_applications;
CREATE POLICY "logistics_applications: anon and auth can insert" ON public.logistics_applications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "logistics_applications: admin can read all" ON public.logistics_applications;
CREATE POLICY "logistics_applications: admin can read all" ON public.logistics_applications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "logistics_applications: admin can update" ON public.logistics_applications;
CREATE POLICY "logistics_applications: admin can update" ON public.logistics_applications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

-- 2. delivery_pricing (MVP config; one active row)
CREATE TABLE IF NOT EXISTS public.delivery_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  base_fee_customer NUMERIC NOT NULL DEFAULT 6.99,
  per_mile_customer NUMERIC NOT NULL DEFAULT 0.75,
  minimum_miles NUMERIC NOT NULL DEFAULT 3,
  base_pay_driver NUMERIC NOT NULL DEFAULT 4.00,
  per_mile_driver NUMERIC NOT NULL DEFAULT 0.60,
  version TEXT NOT NULL DEFAULT 'v1'
);

ALTER TABLE public.delivery_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_pricing: service role and authenticated read" ON public.delivery_pricing;
CREATE POLICY "delivery_pricing: service role and authenticated read" ON public.delivery_pricing
  FOR SELECT USING (auth.role() = 'service_role' OR auth.uid() IS NOT NULL);

INSERT INTO public.delivery_pricing (
  is_active, base_fee_customer, per_mile_customer, minimum_miles,
  base_pay_driver, per_mile_driver, version
)
SELECT true, 6.99, 0.75, 3, 4.00, 0.60, 'v1'
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_pricing WHERE version = 'v1');

-- 3. orders: add delivery fields (nullable)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_selected BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_distance_miles NUMERIC NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee_customer NUMERIC NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee_driver_estimate NUMERIC NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_margin NUMERIC NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status TEXT NULL DEFAULT 'unassigned';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_pricing_version TEXT NULL;

-- 4. drivers: add profile_id (nullable), make user_id nullable for on-demand drivers without account yet
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'drivers' AND column_name = 'user_id') THEN
    ALTER TABLE drivers ALTER COLUMN user_id DROP NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS service_radius_miles INT NOT NULL DEFAULT 15;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_drivers_profile_id ON drivers(profile_id);
