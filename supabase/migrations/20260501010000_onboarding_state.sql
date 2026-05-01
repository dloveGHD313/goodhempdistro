-- Build 9: capture user state/region for compliance + product recommendations.

alter table public.profiles
  add column if not exists onboarding_state text;

comment on column public.profiles.onboarding_state is
  'US state code (e.g. TN, CA), DC, or XX for outside US. Used for regional compliance and product recommendations';
