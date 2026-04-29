create table if not exists public.referral_codes (id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),user_id uuid not null references auth.users(id) on delete cascade,code text not null unique,is_active boolean not null default true,total_referrals integer not null default 0,total_earned_cents integer not null default 0,constraint referral_codes_user_id_key unique (user_id));
create table if not exists public.referral_events (id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),referral_code_id uuid not null references public.referral_codes(id),referrer_user_id uuid not null references auth.users(id),referred_user_id uuid not null references auth.users(id),referred_user_email text,event_type text not null,plan_key text,plan_cadence text,plan_price_cents integer,stripe_subscription_id text,status text not null default 'active',unique (referred_user_id));
create table if not exists public.loyalty_points_ledger (id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),user_id uuid not null references auth.users(id) on delete cascade,points integer not null,balance_after integer not null,event_type text not null,referral_event_id uuid references public.referral_events(id),description text,metadata jsonb default '{}');
create table if not exists public.affiliate_payouts (id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),affiliate_user_id uuid not null references auth.users(id),referral_event_id uuid not null references public.referral_events(id),instalment_number integer not null,amount_cents integer not null,plan_key text not null,plan_cadence text not null,status text not null default 'pending',stripe_transfer_id text,scheduled_after timestamptz,paid_at timestamptz,notes text);
create table if not exists public.commission_ledger (id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),vendor_id uuid not null references public.vendors(id),vendor_plan text not null,commission_rate_bps integer not null,transaction_amount_cents integer not null,commission_amount_cents integer not null,stripe_payment_intent_id text,stripe_charge_id text,stripe_application_fee_id text,order_id text);
alter table public.vendors add column if not exists listing_limit integer, add column if not exists commission_rate_bps integer, add column if not exists is_vip boolean not null default false, add column if not exists jax_ads_enabled boolean not null default false, add column if not exists priority_placement boolean not null default false;

create or replace function public.award_loyalty_points(
  p_user_id uuid,
  p_points integer,
  p_event_type text,
  p_referral_event_id uuid,
  p_description text
) returns integer
language plpgsql
as $$
declare v_new_balance integer;
begin
  select coalesce(max(balance_after), 0) + p_points into v_new_balance
  from public.loyalty_points_ledger where user_id = p_user_id;
  insert into public.loyalty_points_ledger
    (user_id, points, balance_after, event_type, referral_event_id, description)
  values
    (p_user_id, p_points, v_new_balance, p_event_type, p_referral_event_id, p_description);
  return v_new_balance;
end;
$$;
