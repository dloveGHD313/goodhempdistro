-- Backfill profiles.vendor_status for vendors who paid before
-- migration 086 introduced the SSOT column. Without this,
-- onboardingGate redirects them to /vendors/activate even though
-- they have active subscriptions.

update public.profiles p
set vendor_status = 'active'
from public.vendors v
where v.owner_user_id = p.id
  and p.vendor_status is null
  and (
    v.subscription_status in ('active', 'trialing')
    or v.stripe_subscription_id is not null
    or (v.tier is not null and v.status = 'active' and v.is_approved = true)
  );

-- Audit query (run manually after migration):
-- select count(*) from profiles where vendor_status = 'active';
