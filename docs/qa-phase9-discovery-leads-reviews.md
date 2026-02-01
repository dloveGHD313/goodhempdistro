# Phase 9 — Discovery, Leads, Reviews, Ops (existing features)

Phase 9 is covered by existing functionality. No new migration or feature work required.

## Discovery

- **URL:** `/discover`
- **Nav:** "🧭 Discover" in primary links
- **Behavior:** `getDiscoveryRecommendations()` returns vendors, products, services, events, and education tailored to viewer profile (state/region). Authenticated users get personalized recommendations; anonymous see call-to-action to sign up.
- **Links:** Discover → vendors, products, services, events detail pages; "View all" to `/vendors`, `/products`, etc.

## Leads (inquiries)

- **Service inquiries:** Consumers submit via `/api/services/[id]/inquire`; vendors see leads at `/vendors/services/inquiries`.
- **Admin:** `/admin/inquiries` lists and manages service inquiries.
- **APIs:** `GET/POST /api/admin/inquiries`, `GET/PATCH /api/admin/inquiries/[id]`.

## Reviews

- **APIs:** `GET/POST /api/reviews` (list/create), `GET /api/reviews/summary` (aggregates by entity_type + entity_ids).
- **UI:** `ReviewSection` on product, vendor, event, and service detail pages; `RatingBadge` on product list, vendor directory, services list, events list.
- **Entity types:** product, vendor, event, service (from engagement/reviews schema).

## Ops (admin operations)

- **Audit:** `/admin/audit` — action log (product/service/event approvals, etc.).
- **Moderation:** `/admin/moderation` — posts/comments reports and moderation.
- **Analytics:** `/admin/analytics` — GMV, platform revenue, timeseries, top vendors/items.
- **Product queue:** `/admin/products/queue` — pending_review products, bulk approve/reject.
- **Affiliate payouts:** `/admin/affiliates/payouts` — approve affiliate payout requests (Stripe Transfer).
- **Vendor referral payouts:** `/admin/vendor-referrals/payouts` — approve vendor referral payout requests (Stripe Transfer to vendor Connect).
- **Other:** `/admin/products`, `/admin/services`, `/admin/events`, `/admin/vendors`, `/admin/compliance`, `/admin/id-verifications`, `/admin/drivers`, `/admin/logistics`, etc.

## Verification

- Visit `/discover` — recommendations load; sign up CTA when not logged in.
- Visit a product/vendor/event/service detail page — reviews section and (on list pages) rating badges present.
- As vendor: `/vendors/services/inquiries` — service leads.
- As admin: `/admin/inquiries`, `/admin/audit`, `/admin/analytics`, `/admin/products/queue`, `/admin/affiliates/payouts`, `/admin/vendor-referrals/payouts` — all operational.
