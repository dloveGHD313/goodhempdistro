-- Add the 7 missing columns to align production with code expectations.
-- Original migration 20260429025834 was a no-op due to IF NOT EXISTS
-- guard on the simpler schema created by migration 071.

alter table public.affiliate_payouts
  add column if not exists referral_event_id uuid
    references public.referral_events(id) on delete set null;

alter table public.affiliate_payouts
  add column if not exists instalment_number integer;

alter table public.affiliate_payouts
  add column if not exists plan_key text;

alter table public.affiliate_payouts
  add column if not exists plan_cadence text
    check (plan_cadence in ('monthly', 'annual') or plan_cadence is null);

alter table public.affiliate_payouts
  add column if not exists scheduled_after timestamptz;

alter table public.affiliate_payouts
  add column if not exists paid_at timestamptz;

alter table public.affiliate_payouts
  add column if not exists notes text;

alter table public.affiliate_payouts
  drop constraint if exists affiliate_payouts_status_check;

alter table public.affiliate_payouts
  add constraint affiliate_payouts_status_check
  check (status in ('pending','requested','approved','paid','rejected','forfeited'));

create index if not exists idx_affiliate_payouts_referral_event
  on public.affiliate_payouts (referral_event_id, instalment_number)
  where referral_event_id is not null;

create index if not exists idx_affiliate_payouts_scheduled
  on public.affiliate_payouts (scheduled_after, status)
  where status = 'pending';
