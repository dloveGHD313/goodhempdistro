-- Founding Members program (CEO, 2026-09-24).
-- One funnel link (/founding). A founding member picks the Vendor Enterprise (VIP)
-- plan — monthly or annual — and puts a card on file through Stripe Checkout with a
-- 365-day trial: $0 today, the Enterprise subscription starts billing when the free
-- year ends. The founding NUMBER (1..100) is assigned only when Stripe confirms the
-- checkout, so nobody holds a spot without committing. Hard cap: 100.

create table if not exists public.founding_members (
  user_id                    uuid primary key references auth.users(id) on delete cascade,
  status                     text not null default 'pending'
                             check (status in ('pending', 'active', 'canceled')),
  founding_number            integer unique check (founding_number between 1 and 100),
  kind                       text check (kind is null or kind in ('vendor', 'member')),
  source                     text,                 -- ?ref= on the funnel link (email, instagram, ...)
  plan_key                   text,                 -- vendor_enterprise_monthly | vendor_enterprise_annual
  billing_interval           text check (billing_interval is null or billing_interval in ('month', 'year')),
  stripe_checkout_session_id text,
  stripe_subscription_id     text,
  trial_end                  timestamptz,          -- first charge date
  claimed_at                 timestamptz not null default now(),
  checkout_started_at        timestamptz,
  activated_at               timestamptz,
  notes                      text
);

comment on table public.founding_members is
  'Founding Members program: pending = came through /founding, active = Stripe confirmed the Enterprise 1-year-trial checkout (founding_number assigned, permanent). Cap 100.';

create index if not exists founding_members_status_idx on public.founding_members (status);

alter table public.founding_members enable row level security;

drop policy if exists "founding_members_select_own" on public.founding_members;
create policy "founding_members_select_own"
  on public.founding_members for select
  to authenticated
  using (user_id = auth.uid());
-- No insert/update/delete policies: writes go through the RPCs below (service role only).

-- Single source of truth for the cap.
create or replace function public.founding_cap()
returns integer
language sql
immutable
as $$ select 100 $$;

-- Spots that count against the cap: confirmed members plus checkouts started in the
-- last 2 hours (a Stripe Checkout session is in flight; it expires after 24h but we
-- only hold the spot briefly so abandoned carts free up quickly).
create or replace function public.founding_spots_taken()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.founding_members fm
   where fm.status = 'active'
      or (fm.status = 'pending'
          and fm.stripe_checkout_session_id is not null
          and fm.checkout_started_at > now() - interval '2 hours')
$$;

-- Public counter for the landing page ("N of 100 claimed").
create or replace function public.founding_spots_remaining()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(public.founding_cap() - public.founding_spots_taken(), 0)
$$;

revoke execute on function public.founding_spots_taken() from public;
revoke execute on function public.founding_spots_remaining() from public;
grant  execute on function public.founding_spots_taken() to service_role;
grant  execute on function public.founding_spots_remaining() to anon, authenticated, service_role;

-- 1) Reserve: record that a user came through the funnel (no number yet). Idempotent.
create or replace function public.claim_founding_spot(
  p_user   uuid,
  p_source text default null,
  p_kind   text default null
)
returns table (
  user_id uuid, status text, founding_number integer, kind text, source text,
  claimed_at timestamptz, already boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := case when p_kind in ('vendor','member') then p_kind else 'vendor' end;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'claim_founding_spot is server-only' using errcode = '42501';
  end if;
  if p_user is null then
    raise exception 'user required' using errcode = '22004';
  end if;

  if exists (select 1 from public.founding_members fm where fm.user_id = p_user) then
    update public.founding_members fm
       set kind = coalesce(fm.kind, v_kind),
           source = coalesce(fm.source, nullif(left(coalesce(p_source, ''), 64), ''))
     where fm.user_id = p_user;
    return query
      select fm.user_id, fm.status, fm.founding_number, fm.kind, fm.source, fm.claimed_at, true
        from public.founding_members fm where fm.user_id = p_user;
    return;
  end if;

  return query
    insert into public.founding_members (user_id, kind, source)
    values (p_user, v_kind, nullif(left(coalesce(p_source, ''), 64), ''))
    returning founding_members.user_id, founding_members.status, founding_members.founding_number,
              founding_members.kind, founding_members.source, founding_members.claimed_at, false;
end;
$$;

-- 2) Checkout started: hold a spot for 2 hours while the Stripe session is open.
--    Raises founding_full when the cap is reached.
create or replace function public.start_founding_checkout(
  p_user       uuid,
  p_session_id text,
  p_plan_key   text,
  p_interval   text,
  p_source     text default null
)
returns integer   -- spots remaining after this hold
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'start_founding_checkout is server-only' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('founding_members_claim'));

  insert into public.founding_members (user_id, kind, source)
  values (p_user, 'vendor', nullif(left(coalesce(p_source, ''), 64), ''))
  on conflict (user_id) do nothing;

  if exists (select 1 from public.founding_members fm where fm.user_id = p_user and fm.status = 'active') then
    raise exception 'founding_already_active' using errcode = 'P0001';
  end if;

  -- Does anyone else hold the remaining spots?
  select public.founding_cap() - count(*)::int into v_remaining
    from public.founding_members fm
   where fm.user_id <> p_user
     and (fm.status = 'active'
          or (fm.status = 'pending' and fm.stripe_checkout_session_id is not null
              and fm.checkout_started_at > now() - interval '2 hours'));
  if v_remaining <= 0 then
    raise exception 'founding_full' using errcode = 'P0001';
  end if;

  update public.founding_members
     set stripe_checkout_session_id = p_session_id,
         checkout_started_at = now(),
         plan_key = p_plan_key,
         billing_interval = case when p_interval in ('month','year') then p_interval else billing_interval end
   where user_id = p_user;

  return v_remaining - 1;
end;
$$;

-- 3) Activate: Stripe confirmed the checkout → assign the next founding number.
--    Idempotent (re-delivered webhooks return the existing number).
create or replace function public.activate_founding_spot(
  p_user            uuid,
  p_session_id      text,
  p_subscription_id text,
  p_plan_key        text,
  p_interval        text,
  p_trial_end       timestamptz
)
returns table (user_id uuid, founding_number integer, activated_at timestamptz, already boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'activate_founding_spot is server-only' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('founding_members_claim'));

  insert into public.founding_members (user_id, kind)
  values (p_user, 'vendor')
  on conflict (user_id) do nothing;

  if exists (select 1 from public.founding_members fm where fm.user_id = p_user and fm.status = 'active') then
    update public.founding_members fm
       set stripe_subscription_id = coalesce(fm.stripe_subscription_id, p_subscription_id),
           trial_end = coalesce(fm.trial_end, p_trial_end)
     where fm.user_id = p_user;
    return query
      select fm.user_id, fm.founding_number, fm.activated_at, true
        from public.founding_members fm where fm.user_id = p_user;
    return;
  end if;

  select coalesce(max(fm.founding_number), 0) + 1 into v_next from public.founding_members fm;
  if v_next > public.founding_cap() then
    -- Should not happen (checkout holds a spot); keep the row pending and let ops sort it out.
    raise exception 'founding_full' using errcode = 'P0001';
  end if;

  update public.founding_members
     set status = 'active',
         founding_number = v_next,
         stripe_checkout_session_id = coalesce(p_session_id, stripe_checkout_session_id),
         stripe_subscription_id = p_subscription_id,
         plan_key = coalesce(p_plan_key, plan_key),
         billing_interval = case when p_interval in ('month','year') then p_interval else billing_interval end,
         trial_end = p_trial_end,
         activated_at = now()
   where user_id = p_user;

  return query
    select fm.user_id, fm.founding_number, fm.activated_at, false
      from public.founding_members fm where fm.user_id = p_user;
end;
$$;

revoke execute on function public.claim_founding_spot(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.start_founding_checkout(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.activate_founding_spot(uuid, text, text, text, text, timestamptz) from public, anon, authenticated;
grant  execute on function public.claim_founding_spot(uuid, text, text) to service_role;
grant  execute on function public.start_founding_checkout(uuid, text, text, text, text) to service_role;
grant  execute on function public.activate_founding_spot(uuid, text, text, text, text, timestamptz) to service_role;
