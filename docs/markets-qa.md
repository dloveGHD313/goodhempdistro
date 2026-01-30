# Four Markets QA Checklist

## Ungated markets (public)
- Logged out users can browse:
  - CBD_WELLNESS via `/products` + market switcher
  - INDUSTRIAL via `/products` + market switcher
  - SERVICES via `/services` + market switcher
- Product cards for ungated markets show price and details links.
- Services listings render in `/services` and are browseable.

## INTOXICATING (gated)
- Switching to INTOXICATING shows verification modal.
- Unverified users can see locked cards (name + gated tag), no price, no detail links.
- Product detail for INTOXICATING shows locked view with verification CTA.
- Checkout for INTOXICATING returns 403 with code `GATED_MARKET_REQUIRES_VERIFICATION`.

## Verified user flow
- Verified user can browse INTOXICATING products.
- INTOXICATING product details show price and Buy flow.
- Checkout succeeds for gated items.

## Verification flow
- `/verify` shows entry screen and status banner.
- `/verify/upload` accepts images/PDF and creates pending verification.
- `/verify/status` shows latest status and file links.
- `/admin/id-verifications` allows approve/reject with notes.
- Approve sets `profiles.age_verified=true`, `id_verification_status='verified'`, `id_verified_at=now()`.

## Regression checks
- `/newsfeed` remains public.
- Auth, checkout, onboarding, posts, moderation remain stable.
- No redirect loops.
- No emails leak into UI.
