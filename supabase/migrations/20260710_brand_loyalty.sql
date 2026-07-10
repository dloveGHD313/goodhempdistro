-- Perks spec 2026-07-10 §5: per-vendor brand loyalty.
-- completed_orders increments on each paid order for (user, vendor); at the
-- threshold (3) the user's tier-appropriate status unlocks and a brand
-- coupon is issued into consumer_coupons. RLS: user reads own; writes via
-- service role only.

create table if not exists public.brand_loyalty (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  completed_orders integer not null default 0,
  status text not null default 'None' check (status in ('None', 'Bronze', 'Silver', 'Gold')),
  unlocked_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, vendor_id)
);

create index if not exists brand_loyalty_vendor_idx
  on public.brand_loyalty (vendor_id);

alter table public.brand_loyalty enable row level security;

drop policy if exists "brand_loyalty_select_own" on public.brand_loyalty;
create policy "brand_loyalty_select_own"
  on public.brand_loyalty for select
  using (auth.uid() = user_id);
-- no insert/update/delete policies: service role only
