-- Perks spec 2026-07-10 §4: member coupons.
-- consumer_coupons holds platform member coupons (monthly cron grants) and
-- vendor/brand coupons. RLS: user reads own; all writes via service role.
-- orders.discount_cents records the applied (post-cap) discount for reporting.

create table if not exists public.consumer_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique,
  percent_off numeric not null check (percent_off > 0 and percent_off <= 100),
  source text not null check (source in ('platform', 'vendor')),
  vendor_id uuid references public.vendors(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'redeemed', 'expired')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  redeemed_order_id uuid references public.orders(id) on delete set null,
  -- idempotency key for automated grants, e.g. 'monthly:2026-07:1'
  grant_key text,
  created_at timestamptz not null default now()
);

-- one grant per user per key — monthly cron re-runs are no-ops
create unique index if not exists consumer_coupons_user_grant_key
  on public.consumer_coupons (user_id, grant_key)
  where grant_key is not null;

create index if not exists consumer_coupons_user_status_idx
  on public.consumer_coupons (user_id, status);

alter table public.consumer_coupons enable row level security;

drop policy if exists "consumer_coupons_select_own" on public.consumer_coupons;
create policy "consumer_coupons_select_own"
  on public.consumer_coupons for select
  using (auth.uid() = user_id);
-- no insert/update/delete policies: service role only

alter table public.orders
  add column if not exists discount_cents integer not null default 0;
