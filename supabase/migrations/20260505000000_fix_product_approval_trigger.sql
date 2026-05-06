-- Replaces broken prevent_vendor_approval() trigger
--
-- Original trigger checked auth.uid() unconditionally, which
-- returns NULL when called from service_role admin client.
-- That made every legitimate admin approval throw
-- "Only admins can approve products".
--
-- First fix attempt used a local variable named 'current_role',
-- which silently resolved to the PostgreSQL built-in current_role
-- (synonym for current_user) in IF conditions, bypassing the
-- declared variable entirely and making the service-role check
-- always evaluate against the DB username ('postgres'), not the
-- JWT claim.
--
-- Corrected version:
-- - Renames variable to 'detected_role' (avoids reserved keyword)
-- - PRIMARY bypass: auth.uid() IS NULL — the only universally
--   reliable service-role signal (true for service_role, direct
--   postgres, and any non-session context)
-- - SECONDARY bypass: JWT claim check via detected_role
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
  detected_role text;
  user_is_admin boolean;
begin
  -- Only fire on actual transitions to 'approved'
  if new.status is null or new.status != 'approved' then
    return new;
  end if;

  if old.status = 'approved' then
    return new;
  end if;

  -- PRIMARY CHECK: auth.uid() is null only when there's no user
  -- session. This is the most reliable service-role indicator.
  -- Service-role admin updates (from API routes using
  -- SUPABASE_SERVICE_ROLE_KEY) and direct postgres connections
  -- both have null auth.uid().
  -- Application-level admin gate (lib/auth/requireAdmin.ts)
  -- has already verified admin status before reaching this
  -- trigger via the API path.
  if auth.uid() is null then
    return new;
  end if;

  -- SECONDARY CHECK: try to detect service_role via JWT claim
  -- (defense-in-depth for any future caller patterns)
  detected_role := coalesce(
    current_setting('request.jwt.claim.role', true),
    auth.role()
  );

  if detected_role = 'service_role' then
    return new;
  end if;

  -- AUTHENTICATED USER PATH: must be admin in profiles
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
