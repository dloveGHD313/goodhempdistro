-- ============================================================================
-- Two Markets (CBD + Gated) - products + profile fields (idempotent)
-- ============================================================================

-- Products: gated market flag
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_gated BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_is_gated_status_active
  ON public.products (is_gated, status, active);

-- Profiles: market preferences + verification fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS market_mode_preference TEXT NOT NULL DEFAULT 'CBD';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consumer_interest_tags TEXT[] DEFAULT '{}';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consumer_use_case TEXT DEFAULT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_verified BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id_verification_status TEXT NOT NULL DEFAULT 'unverified';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id_verification_provider TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS id_verified_at TIMESTAMPTZ NULL;
