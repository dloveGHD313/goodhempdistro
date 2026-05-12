-- Phase 4 / Build #3 PR-A — Stripe Connect schema additions for vendor payouts.
--
-- This migration adds ONLY the pieces missing from existing vendor Connect
-- infrastructure (migration 069 already shipped vendor_connect_accounts).
--
-- What's already in production (from 069):
--   - vendor_connect_accounts (user_id, stripe_account_id, charges_enabled,
--     payouts_enabled, created_at, updated_at)
--   - RLS: owner can read/insert/update own row
--   - Live API routes: create-account, onboard-link, status
--
-- What this migration adds:
--   1. vendor_connect_accounts.payout_schedule_preference — daily|weekly|monthly
--   2. platform_reserve table — 7-day held-funds ledger for refund/dispute protection
--   3. stripe_connect_events table — idempotent webhook log (event_id unique)
--
-- Per CEO directive: vendors choose payout cadence via Stripe Express dashboard;
-- this column reflects their choice for our UI display + future analytics.

-- ────────────────────────────────────────────────────────────────────────
-- 1. payout schedule preference on existing Connect accounts table
-- ────────────────────────────────────────────────────────────────────────

alter table public.vendor_connect_accounts
  add column if not exists payout_schedule_preference text
    check (payout_schedule_preference in ('daily','weekly','monthly') or payout_schedule_preference is null);

comment on column public.vendor_connect_accounts.payout_schedule_preference is
  'Mirror of vendor-chosen payout cadence in Stripe Express dashboard. Source of truth lives in Stripe; this is a cached display value updated by the account.updated webhook.';

-- ────────────────────────────────────────────────────────────────────────
-- 2. platform_reserve — 7-day hold on completed orders for refund/dispute protection
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.platform_reserve (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  amount_cents integer not null check (amount_cents >= 0),
  reason text not null check (reason in ('order_completion','dispute_extension','manual_hold')),
  held_until timestamptz not null,
  released_at timestamptz,
  released_to_stripe_transfer_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_platform_reserve_vendor on public.platform_reserve(vendor_id);
create index if not exists idx_platform_reserve_held_until on public.platform_reserve(held_until) where released_at is null;
create index if not exists idx_platform_reserve_pending on public.platform_reserve(vendor_id, held_until) where released_at is null;

alter table public.platform_reserve enable row level security;

drop policy if exists "platform_reserve: vendor reads own" on public.platform_reserve;
create policy "platform_reserve: vendor reads own" on public.platform_reserve
  for select using (
    vendor_id in (select id from public.vendors where owner_user_id = auth.uid())
  );

-- Inserts / updates only via service role (server code). No client write policy.

comment on table public.platform_reserve is
  '7-day held-funds ledger. When an order completes, a row is queued with held_until = now() + 7 days. A daily cron releases rows where held_until < now() and released_at is null by creating a Stripe transfer to the vendor''s Connect account. Disputes extend the hold via dispute_extension rows.';

comment on column public.platform_reserve.reason is
  'order_completion: first-time 7-day hold after checkout completes. dispute_extension: additional hold added when charge.dispute.created fires. manual_hold: admin-applied hold for compliance/quality concerns.';

-- ────────────────────────────────────────────────────────────────────────
-- 3. stripe_connect_events — idempotent webhook log
-- ────────────────────────────────────────────────────────────────────────

create table if not exists public.stripe_connect_events (
  event_id text primary key,
  event_type text not null,
  vendor_id uuid references public.vendors(id) on delete set null,
  stripe_account_id text,
  payload jsonb not null,
  processed_at timestamptz,
  processed_outcome text check (processed_outcome in ('ok','error','skipped') or processed_outcome is null),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_stripe_connect_events_type on public.stripe_connect_events(event_type, created_at desc);
create index if not exists idx_stripe_connect_events_vendor on public.stripe_connect_events(vendor_id, created_at desc) where vendor_id is not null;
create index if not exists idx_stripe_connect_events_account on public.stripe_connect_events(stripe_account_id, created_at desc) where stripe_account_id is not null;
create index if not exists idx_stripe_connect_events_unprocessed on public.stripe_connect_events(created_at) where processed_at is null;

alter table public.stripe_connect_events enable row level security;

-- Admin-only reads (via service role; no public read).
-- No INSERT/UPDATE policy — server-only writes.

comment on table public.stripe_connect_events is
  'Idempotent log of Stripe Connect webhook events. Primary key is the Stripe event_id, so a duplicate webhook (Stripe retries) is rejected by the unique constraint. processed_at is set when the handler completes; processed_outcome reports ok/error/skipped.';

-- ────────────────────────────────────────────────────────────────────────
-- ROLLBACK (manual — comment out the migration line above and run this if needed)
-- ────────────────────────────────────────────────────────────────────────
-- drop table if exists public.stripe_connect_events;
-- drop table if exists public.platform_reserve;
-- alter table public.vendor_connect_accounts drop column if exists payout_schedule_preference;
