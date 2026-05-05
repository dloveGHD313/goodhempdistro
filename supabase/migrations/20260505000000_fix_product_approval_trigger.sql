-- Replaces broken prevent_vendor_approval() trigger
--
-- Original trigger checked auth.uid() unconditionally, which
-- returns NULL when called from service_role admin client.
-- That made every legitimate admin approval throw
-- "Only admins can approve products".
--
-- New version:
-- - Recognizes service_role context and trusts upstream
--   application gate (lib/auth/requireAdmin.ts)
-- - Still blocks authenticated non-admin users from flipping
--   status to 'approved' (defense-in-depth against direct DB
--   updates from vendor sessions)
-- - Only fires on status transitions, not all UPDATEs
-- - Applied to products, events, and services (shared function)

-- Drop the broken function and all dependent triggers
drop trigger if exists prevent_vendor_product_approval on public.products;
drop trigger if exists prevent_vendor_event_approval on public.events;
drop trigger if exists prevent_vendor_service_approval on public.services;
drop function if exists public.prevent_vendor_approval() cascade;

-- Recreate with service-role awareness
create or replace function public.prevent_vendor_approval()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_role text;
  user_is_admin boolean;
begin
  -- Only fire when status is being changed to 'approved'
  if new.status is null or new.status != 'approved' then
    return new;
  end if;

  if old.status = 'approved' then
    return new; -- already approved, no change to gate
  end if;

  -- Detect role of current connection.
  -- Service role bypasses this check (application code already
  -- verified admin via requireAdmin()).
  select current_setting('request.jwt.claim.role', true) into current_role;

  if current_role = 'service_role' or current_role is null then
    -- Service role context: trust the application gate
    return new;
  end if;

  -- Authenticated user context: require admin in profiles
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) into user_is_admin;

  if not user_is_admin then
    raise exception 'Only admins can approve products'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- Recreate all three triggers with identical structure
create trigger prevent_vendor_product_approval
  before update on public.products
  for each row
  when (new.status is distinct from old.status)
  execute function public.prevent_vendor_approval();

create trigger prevent_vendor_event_approval
  before update on public.events
  for each row
  when (new.status is distinct from old.status)
  execute function public.prevent_vendor_approval();

create trigger prevent_vendor_service_approval
  before update on public.services
  for each row
  when (new.status is distinct from old.status)
  execute function public.prevent_vendor_approval();
