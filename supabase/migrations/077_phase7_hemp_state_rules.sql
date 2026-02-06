-- ============================================================================
-- Phase 7: State rules for sale/delivery of hemp-derived products
-- Verifiable sources; default-safe (delivery disallowed until verified).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.hemp_state_rules (
  state_code TEXT PRIMARY KEY,
  allows_sale_non_intoxicating BOOLEAN NOT NULL DEFAULT true,
  allows_delivery_non_intoxicating BOOLEAN NOT NULL DEFAULT false,
  allows_sale_intoxicating BOOLEAN NOT NULL DEFAULT true,
  allows_delivery_intoxicating BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_verified_at TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.hemp_state_rules IS 'Per-state legality: sale and delivery for non-intoxicating vs intoxicating hemp. sources: array of { url, title, publisher, accessed_at }';

CREATE INDEX IF NOT EXISTS idx_hemp_state_rules_delivery_intoxicating
  ON public.hemp_state_rules (allows_delivery_intoxicating) WHERE allows_delivery_intoxicating = true;
CREATE INDEX IF NOT EXISTS idx_hemp_state_rules_delivery_non_intoxicating
  ON public.hemp_state_rules (allows_delivery_non_intoxicating) WHERE allows_delivery_non_intoxicating = true;

ALTER TABLE public.hemp_state_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hemp_state_rules: public read" ON public.hemp_state_rules;
CREATE POLICY "hemp_state_rules: public read" ON public.hemp_state_rules
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "hemp_state_rules: admin write" ON public.hemp_state_rules;
CREATE POLICY "hemp_state_rules: admin write" ON public.hemp_state_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
  );

-- Seed: no rows by default; admin must import with sources. Optional: insert placeholder row per state with allows_* = false so lookup never returns null for known states.
-- For "default-safe" we treat missing state as: delivery not allowed, sale allowed for non-intoxicating only.
