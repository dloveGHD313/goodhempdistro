-- ============================================================================
-- Phase 7: Product compliance classification (intoxicating, delta8)
-- Delta-8 products are not allowed on platform: block active/visible.
-- ============================================================================

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_intoxicating BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_delta8 BOOLEAN NOT NULL DEFAULT false;

-- Backfill from existing product_type
UPDATE public.products
SET
  is_intoxicating = (product_type = 'intoxicating'),
  is_delta8 = (product_type = 'delta8')
WHERE product_type IS NOT NULL AND (is_intoxicating IS DISTINCT FROM (product_type = 'intoxicating') OR is_delta8 IS DISTINCT FROM (product_type = 'delta8'));

-- Delta-8 must never be active/approved (no D8 SKUs visible or purchasable)
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_no_delta8_active;
ALTER TABLE public.products ADD CONSTRAINT products_no_delta8_active
  CHECK (NOT (active = true AND is_delta8 = true));

CREATE INDEX IF NOT EXISTS idx_products_is_delta8 ON public.products(is_delta8) WHERE is_delta8 = false;
CREATE INDEX IF NOT EXISTS idx_products_is_intoxicating ON public.products(is_intoxicating);
