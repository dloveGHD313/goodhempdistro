-- ============================================================================
-- Phase 7: State-aware delivery legality (hemp-derived products)
-- Delivery is ONLY allowed where state law permits.
-- Sources: USDA Hemp Program (2018 Farm Bill), state DoA, state alcohol control.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hemp_delivery_state_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code CHAR(2) NOT NULL UNIQUE,
  delivery_allowed BOOLEAN NOT NULL DEFAULT false,
  in_person_only BOOLEAN NOT NULL DEFAULT false,
  intoxicating_hemp_allowed BOOLEAN NOT NULL DEFAULT false,
  citation_url TEXT,
  source_authority TEXT,
  last_verified_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hemp_delivery_state_rules_state_code
  ON public.hemp_delivery_state_rules (state_code);
CREATE INDEX IF NOT EXISTS idx_hemp_delivery_state_rules_delivery_allowed
  ON public.hemp_delivery_state_rules (delivery_allowed) WHERE delivery_allowed = true;

ALTER TABLE public.hemp_delivery_state_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hemp_delivery_state_rules: authenticated read" ON public.hemp_delivery_state_rules;
CREATE POLICY "hemp_delivery_state_rules: authenticated read" ON public.hemp_delivery_state_rules
  FOR SELECT USING (auth.role() = 'service_role' OR auth.uid() IS NOT NULL);

-- Seed: all 50 states + DC. delivery_allowed = false by default until verified per state.
-- Citation/source must be updated per state from state statutes and DoA.
INSERT INTO public.hemp_delivery_state_rules (
  state_code, delivery_allowed, in_person_only, intoxicating_hemp_allowed, source_authority
) VALUES
  ('AL', false, false, false, 'State statute / DoA — verify before enabling'),
  ('AK', false, false, false, 'State statute / DoA — verify before enabling'),
  ('AZ', false, false, false, 'State statute / DoA — verify before enabling'),
  ('AR', false, false, false, 'State statute / DoA — verify before enabling'),
  ('CA', false, false, false, 'State statute / DoA — verify before enabling'),
  ('CO', false, false, false, 'State statute / DoA — verify before enabling'),
  ('CT', false, false, false, 'State statute / DoA — verify before enabling'),
  ('DE', false, false, false, 'State statute / DoA — verify before enabling'),
  ('DC', false, false, false, 'District statute — verify before enabling'),
  ('FL', false, false, false, 'State statute / DoA — verify before enabling'),
  ('GA', false, false, false, 'State statute / DoA — verify before enabling'),
  ('HI', false, false, false, 'State statute / DoA — verify before enabling'),
  ('ID', false, false, false, 'State statute / DoA — verify before enabling'),
  ('IL', false, false, false, 'State statute / DoA — verify before enabling'),
  ('IN', false, false, false, 'State statute / DoA — verify before enabling'),
  ('IA', false, false, false, 'State statute / DoA — verify before enabling'),
  ('KS', false, false, false, 'State statute / DoA — verify before enabling'),
  ('KY', false, false, false, 'State statute / DoA — verify before enabling'),
  ('LA', false, false, false, 'State statute / DoA — verify before enabling'),
  ('ME', false, false, false, 'State statute / DoA — verify before enabling'),
  ('MD', false, false, false, 'State statute / DoA — verify before enabling'),
  ('MA', false, false, false, 'State statute / DoA — verify before enabling'),
  ('MI', false, false, false, 'State statute / DoA — verify before enabling'),
  ('MN', false, false, false, 'State statute / DoA — verify before enabling'),
  ('MS', false, false, false, 'State statute / DoA — verify before enabling'),
  ('MO', false, false, false, 'State statute / DoA — verify before enabling'),
  ('MT', false, false, false, 'State statute / DoA — verify before enabling'),
  ('NE', false, false, false, 'State statute / DoA — verify before enabling'),
  ('NV', false, false, false, 'State statute / DoA — verify before enabling'),
  ('NH', false, false, false, 'State statute / DoA — verify before enabling'),
  ('NJ', false, false, false, 'State statute / DoA — verify before enabling'),
  ('NM', false, false, false, 'State statute / DoA — verify before enabling'),
  ('NY', false, false, false, 'State statute / DoA — verify before enabling'),
  ('NC', false, false, false, 'State statute / DoA — verify before enabling'),
  ('ND', false, false, false, 'State statute / DoA — verify before enabling'),
  ('OH', false, false, false, 'State statute / DoA — verify before enabling'),
  ('OK', false, false, false, 'State statute / DoA — verify before enabling'),
  ('OR', false, false, false, 'State statute / DoA — verify before enabling'),
  ('PA', false, false, false, 'State statute / DoA — verify before enabling'),
  ('RI', false, false, false, 'State statute / DoA — verify before enabling'),
  ('SC', false, false, false, 'State statute / DoA — verify before enabling'),
  ('SD', false, false, false, 'State statute / DoA — verify before enabling'),
  ('TN', false, false, false, 'State statute / DoA — verify before enabling'),
  ('TX', false, false, false, 'State statute / DoA — verify before enabling'),
  ('UT', false, false, false, 'State statute / DoA — verify before enabling'),
  ('VT', false, false, false, 'State statute / DoA — verify before enabling'),
  ('VA', false, false, false, 'State statute / DoA — verify before enabling'),
  ('WA', false, false, false, 'State statute / DoA — verify before enabling'),
  ('WV', false, false, false, 'State statute / DoA — verify before enabling'),
  ('WI', false, false, false, 'State statute / DoA — verify before enabling'),
  ('WY', false, false, false, 'State statute / DoA — verify before enabling')
ON CONFLICT (state_code) DO NOTHING;
