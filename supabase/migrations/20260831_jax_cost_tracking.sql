-- Phase 5 (Ask JAX): token/cost tracking for the $50/month global hard cutoff.
--
-- Additive only: two BIGINT token counters on the existing daily table plus
-- one new RPC that increments message count AND token counters atomically.
-- Dollar cost is computed at read time from the token sums (storing rounded
-- per-call cents would floor small calls to 0 and never accumulate).

alter table public.jax_global_daily
  add column if not exists input_tokens bigint not null default 0,
  add column if not exists output_tokens bigint not null default 0;

comment on column public.jax_global_daily.input_tokens is
  'Sum of OpenAI prompt tokens for the day (cost cap: computed read-side).';
comment on column public.jax_global_daily.output_tokens is
  'Sum of OpenAI completion tokens for the day (cost cap: computed read-side).';

create or replace function public.jax_increment_global_daily_with_cost(
  p_input_tokens bigint,
  p_output_tokens bigint
)
returns int language plpgsql security definer as $$
declare
  new_count int;
begin
  insert into public.jax_global_daily (day_utc, message_count, input_tokens, output_tokens)
  values (
    ((now() at time zone 'utc')::date),
    1,
    greatest(coalesce(p_input_tokens, 0), 0),
    greatest(coalesce(p_output_tokens, 0), 0)
  )
  on conflict (day_utc) do update set
    message_count = jax_global_daily.message_count + 1,
    input_tokens = jax_global_daily.input_tokens + greatest(coalesce(p_input_tokens, 0), 0),
    output_tokens = jax_global_daily.output_tokens + greatest(coalesce(p_output_tokens, 0), 0),
    updated_at = now()
  returning message_count into new_count;

  return new_count;
end;
$$;

revoke all on function public.jax_increment_global_daily_with_cost(bigint, bigint) from public;
grant execute on function public.jax_increment_global_daily_with_cost(bigint, bigint) to service_role;
