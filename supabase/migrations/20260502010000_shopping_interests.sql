-- Build 10 revisions: multi-select shopping interests captured during
-- /onboarding/consumer. Used for product pre-filtering on /products and
-- vendor recommendations on /newsfeed.

alter table public.profiles
  add column if not exists shopping_interests text[] default '{}';

comment on column public.profiles.shopping_interests is
  'Multi-select shopping interests from onboarding (e.g. wellness, skincare, business-supplies). Used for product/vendor recommendations. Legacy columns consumer_use_case and consumer_interest_tags remain for backward compatibility.';
