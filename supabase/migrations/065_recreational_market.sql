-- ============================================================================
-- Recreational market: replace INTOXICATING with RECREATIONAL everywhere
-- Single canonical value; UI must never show Intoxicating/Psychoactive
-- ============================================================================

-- Products: migrate market_category
UPDATE public.products
SET market_category = 'RECREATIONAL'
WHERE market_category = 'INTOXICATING';

-- Drop and recreate products check to allow RECREATIONAL
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_market_gated_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_market_gated_check
  CHECK (
    (market_category = 'RECREATIONAL' AND is_gated = true)
    OR (market_category <> 'RECREATIONAL' AND is_gated = false)
  );

-- Profiles: migrate market_mode_preference
UPDATE public.profiles
SET market_mode_preference = 'RECREATIONAL'
WHERE market_mode_preference IN ('INTOXICATING', 'GATED');

UPDATE public.profiles
SET market_mode_preference = CASE market_mode_preference
  WHEN 'CBD' THEN 'CBD_WELLNESS'
  ELSE market_mode_preference
END
WHERE market_mode_preference = 'CBD';

-- Drop and recreate profiles check to allow RECREATIONAL
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_market_mode_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_market_mode_check
  CHECK (market_mode_preference IN ('CBD_WELLNESS', 'INDUSTRIAL', 'SERVICES', 'RECREATIONAL'));
