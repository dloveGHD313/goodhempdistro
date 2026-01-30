-- ============================================================================
-- Four market categories (idempotent)
-- ============================================================================

-- Products: market category + gated flag
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS market_category TEXT NOT NULL DEFAULT 'CBD_WELLNESS';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_gated BOOLEAN NOT NULL DEFAULT false;

UPDATE public.products
SET market_category = CASE
  WHEN market_category IS NULL OR market_category NOT IN ('CBD_WELLNESS', 'INDUSTRIAL', 'SERVICES', 'INTOXICATING') THEN
    CASE WHEN is_gated THEN 'INTOXICATING' ELSE 'CBD_WELLNESS' END
  ELSE market_category
END;
WHERE market_category IS NULL
   OR market_category NOT IN ('CBD_WELLNESS', 'INDUSTRIAL', 'SERVICES', 'INTOXICATING');

UPDATE public.products
SET is_gated = CASE WHEN market_category = 'INTOXICATING' THEN true ELSE false END
WHERE is_gated IS DISTINCT FROM (market_category = 'INTOXICATING');

CREATE INDEX IF NOT EXISTS idx_products_market_category
  ON public.products (market_category);

CREATE INDEX IF NOT EXISTS idx_products_is_gated
  ON public.products (is_gated);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_market_gated_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_market_gated_check
      CHECK (
        (market_category = 'INTOXICATING' AND is_gated = true)
        OR (market_category <> 'INTOXICATING' AND is_gated = false)
      );
  END IF;
END $$;

-- Profiles: market preference + verification fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS market_mode_preference TEXT NOT NULL DEFAULT 'CBD_WELLNESS';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consumer_interest_tags TEXT[] DEFAULT '{}';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consumer_use_case TEXT DEFAULT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_verified BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id_verification_status TEXT NOT NULL DEFAULT 'unverified';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id_verified_at TIMESTAMPTZ NULL;

UPDATE public.profiles
SET market_mode_preference = CASE market_mode_preference
  WHEN 'CBD' THEN 'CBD_WELLNESS'
  WHEN 'GATED' THEN 'INTOXICATING'
  ELSE market_mode_preference
END
WHERE market_mode_preference IN ('CBD', 'GATED');

UPDATE public.profiles
SET market_mode_preference = 'CBD_WELLNESS'
WHERE market_mode_preference IS NULL
   OR market_mode_preference NOT IN ('CBD_WELLNESS', 'INDUSTRIAL', 'SERVICES', 'INTOXICATING');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_market_mode_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_market_mode_check
      CHECK (market_mode_preference IN ('CBD_WELLNESS', 'INDUSTRIAL', 'SERVICES', 'INTOXICATING'));
  END IF;
END $$;
