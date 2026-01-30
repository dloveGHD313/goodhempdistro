# Market Gating QA Checklist

## CBD Market (public)
- Logged out user can browse `/products` and see CBD products.
- CBD product cards show price, details, and can open product detail.
- CBD product detail allows checkout when all other requirements are met.

## Gated Market (unverified)
- Switching to GATED mode shows 21+ modal and remains in CBD mode.
- Gated product cards (if surfaced) show locked state: no price, no detail link.
- Visiting a gated product detail URL renders locked page with verification CTA.
- Checkout for gated items returns 403 with code `GATED_MARKET_REQUIRES_VERIFICATION`.

## Gated Market (verified)
- Verified user can switch to GATED mode.
- Gated product cards show price and open product detail.
- Gated product detail renders full pricing and Buy flow.
- Checkout for gated items succeeds.

## Verification flow
- `/verify` shows entry screen and correct status banner.
- `/verify/upload` allows file upload and creates a pending verification.
- `/verify/status` shows pending/verified/rejected status and files.
- Admin `/admin/id-verifications` can approve/reject with notes.
- Approve sets `profiles.age_verified=true`, `profiles.id_verification_status='verified'`, `id_verified_at` set.
- Reject sets `profiles.age_verified=false`, `profiles.id_verification_status='rejected'`.

## Regression checks
- `/newsfeed` remains public.
- Onboarding and existing auth/checkout flows remain functional.
- No redirect loops on verify pages.
