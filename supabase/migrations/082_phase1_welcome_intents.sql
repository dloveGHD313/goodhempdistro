-- ============================================================================
-- Phase 1: Welcome intents persistence
-- Stores onboarding intents from /welcome (shop, sell, events, etc.) in profiles.
-- Existing columns (interests, purchase_intent, consumer_interest_tags) are used
-- by consumer onboarding with different semantics; a dedicated column is required.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_intents TEXT[] DEFAULT '{}';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_intents_updated_at TIMESTAMPTZ;
