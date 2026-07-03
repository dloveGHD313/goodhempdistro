-- ============================================================================
-- P0-0 / P1-3 — align repo migrations with production subscriptions table.
--
-- Two batches of drift, both applied directly to prod via Supabase MCP:
--
--   2026-07-02 (manual, during paid smoke test):
--     - plan_type TEXT, plan_id TEXT, price_id TEXT added
--     - UNIQUE index on stripe_subscription_id added
--       (subscriptions_stripe_subscription_id_key) — required by the
--       webhook upsert's onConflict: "stripe_subscription_id"
--
--   2026-07-03 (P0-0 companion):
--     - current_period_start TIMESTAMPTZ
--     - cancel_at_period_end BOOLEAN NOT NULL DEFAULT false
--       The webhook upsert writes both; the RangeError fixed in the same
--       PR was masking the 42703 these would have thrown.
--
-- NOTE: do NOT re-run repo migration 004 wholesale against prod — prod's
-- table shape differs (it also carries stripe_price_id). This migration is
-- idempotent (IF NOT EXISTS everywhere) and records prod reality.
-- ============================================================================

alter table public.subscriptions
  add column if not exists plan_type text;
alter table public.subscriptions
  add column if not exists plan_id text;
alter table public.subscriptions
  add column if not exists price_id text;
alter table public.subscriptions
  add column if not exists current_period_start timestamptz;
alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

-- Unique index required by webhook upsert onConflict.
-- (Named to match what was created manually in prod on 7/2.)
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and indexname = 'subscriptions_stripe_subscription_id_key'
  ) then
    create unique index subscriptions_stripe_subscription_id_key
      on public.subscriptions (stripe_subscription_id);
  end if;
end $$;
