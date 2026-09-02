-- Founding-vendor comp (free N months) + RPC hardening
-- Context: CEO is offering founding vendors a free first year. Until now the only
-- way a vendor passed the dashboard gate (lib/server/isVendorActive.ts) was the
-- Stripe-driven SSOT or a live Stripe subscription, so an admin "Activate" did
-- not actually unlock the vendor dashboard. vendors.comp_until fixes that.
-- Also closes two advisor findings from the 2026-09-02 security scan.

-- 1) Comp window ------------------------------------------------------------
alter table public.vendors
  add column if not exists comp_until timestamptz;

comment on column public.vendors.comp_until is
  'Founding-vendor comp: vendor is treated as active (no Stripe subscription required) until this timestamp. Set by admins via /api/admin/vendors/[id]/activate.';

create index if not exists vendors_comp_until_idx
  on public.vendors (comp_until)
  where comp_until is not null;

-- 2) admin_list_vendor_applications: align guard with approve_vendor/reject_vendor
-- Previous version filtered rows with a WHERE EXISTS(profiles.role='admin') clause
-- (non-admins silently got zero rows). This version recognises admin_users and
-- service_role too, fails loudly, and is no longer executable by anon.
create or replace function public.admin_list_vendor_applications()
returns table (
  id uuid,
  user_id uuid,
  business_name text,
  description text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  user_email text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    coalesce(auth.role(), '') = 'service_role'
    or exists (select 1 from public.admin_users au where au.user_id = auth.uid())
    or exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin')
  ) then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
    select va.id, va.user_id, va.business_name, va.description, va.status,
           va.created_at, va.updated_at, p.email as user_email
      from public.vendor_applications va
      left join public.profiles p on p.id = va.user_id
     order by va.created_at desc;
end;
$$;

revoke execute on function public.admin_list_vendor_applications() from public, anon;
grant  execute on function public.admin_list_vendor_applications() to authenticated, service_role;

-- 3) JAX usage counters: server-only (called via service-role admin client) ---
-- Executable by anon/authenticated meant anyone could inflate the counters and
-- exhaust the daily/monthly Ask-JAX caps.
revoke execute on function public.jax_increment_user_monthly(uuid) from public, anon, authenticated;
revoke execute on function public.jax_increment_global_daily() from public, anon, authenticated;
revoke execute on function public.jax_increment_global_daily_with_cost(bigint, bigint) from public, anon, authenticated;
grant  execute on function public.jax_increment_user_monthly(uuid) to service_role;
grant  execute on function public.jax_increment_global_daily() to service_role;
grant  execute on function public.jax_increment_global_daily_with_cost(bigint, bigint) to service_role;

alter function public.jax_increment_user_monthly(uuid) set search_path = public;
alter function public.jax_increment_global_daily() set search_path = public;
alter function public.jax_increment_global_daily_with_cost(bigint, bigint) set search_path = public;
