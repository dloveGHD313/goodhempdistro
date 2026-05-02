-- Build 10: paid-only Ask JAX. Tracks per-user monthly message counts
-- for tier caps, plus a global daily counter for the circuit breaker.

-- Per-user monthly counter
create table if not exists public.jax_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_year text not null,
  message_count int not null default 0,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists jax_usage_user_month on public.jax_usage(user_id, month_year);
create index if not exists jax_usage_month on public.jax_usage(month_year);

alter table public.jax_usage enable row level security;

drop policy if exists "Users see own usage" on public.jax_usage;
create policy "Users see own usage" on public.jax_usage
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Service role full access on usage" on public.jax_usage;
create policy "Service role full access on usage" on public.jax_usage
  for all to service_role using (true) with check (true);

-- Global daily counter for circuit breaker
create table if not exists public.jax_global_daily (
  day_utc date primary key,
  message_count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.jax_global_daily enable row level security;

drop policy if exists "Service role only daily" on public.jax_global_daily;
create policy "Service role only daily" on public.jax_global_daily
  for all to service_role using (true) with check (true);

-- Atomic increment functions. Returning the new count after the upsert
-- avoids the read-then-write race when the API checks caps.

create or replace function public.jax_increment_user_monthly(p_user_id uuid)
returns int language plpgsql security definer as $$
declare
  new_count int;
  current_month text;
begin
  current_month := to_char((now() at time zone 'utc'), 'YYYY-MM');

  insert into public.jax_usage (user_id, month_year, message_count)
  values (p_user_id, current_month, 1)
  on conflict (user_id, month_year) do update set
    message_count = jax_usage.message_count + 1,
    last_message_at = now(),
    updated_at = now()
  returning message_count into new_count;

  return new_count;
end;
$$;

create or replace function public.jax_increment_global_daily()
returns int language plpgsql security definer as $$
declare
  new_count int;
begin
  insert into public.jax_global_daily (day_utc, message_count)
  values (((now() at time zone 'utc')::date), 1)
  on conflict (day_utc) do update set
    message_count = jax_global_daily.message_count + 1,
    updated_at = now()
  returning message_count into new_count;

  return new_count;
end;
$$;

revoke all on function public.jax_increment_user_monthly(uuid) from public;
revoke all on function public.jax_increment_global_daily() from public;
grant execute on function public.jax_increment_user_monthly(uuid) to service_role;
grant execute on function public.jax_increment_global_daily() to service_role;

comment on table public.jax_usage is
  'Per-user JAX message count for the current month. Resets implicitly when month_year changes.';
comment on table public.jax_global_daily is
  'Global daily JAX message count for the circuit breaker (JAX_DAILY_GLOBAL_CAP).';
