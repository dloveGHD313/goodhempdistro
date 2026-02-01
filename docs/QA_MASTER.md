# QA Master — GoodHempDistro

Baseline and phase verification. Update after each phase.

## Baseline (Phase 0)

- **Build:** `npm run build` — **PASS** (Next.js 16.1.1, Turbopack)
- **Lint/Test:** Run `npm run lint` / `npm run test` if present and record here.
- **Vendor product edit:** Server component loads product via GET `/api/vendors/products/[id]` with forwarded cookies; API uses `getSession()`. Edit page: `/vendors/products/[id]/edit`, dashboard link: `/vendors/dashboard/products`.

## Test URLs (key flows)

| Flow | URL | Notes |
|------|-----|--------|
| Vendor product edit | `/vendors/products/[id]/edit` | Requires vendor session; base URL from headers. |
| Vendor dashboard products | `/vendors/dashboard/products` | List + link to edit. |
| Vendor services edit | `/vendors/services/[id]/edit` | Client-loaded; parity with products. |
| Admin products | `/admin/products` | Admin gate. |
| Admin product queue | `/admin/products/queue` | Pending first. |
| Admin audit | `/admin/audit` | Audit log. |

## Phase checklists

- **Phase 1 — Products edit parity:** See `docs/qa-products-parity.md`
- **Phase 2 — Orders:** See `docs/qa-commerce-orders.md`
- **Phase 3 — Platform fees:** See `docs/qa-platform-fees.md`
- **Phase 4 — Vendor Connect:** Stripe Connect Express; `/vendors/payouts`; APIs create-account, onboard-link, status
- **Phase 5 — Admin analytics:** See `docs/qa-admin-analytics.md`
- **Phase 6 — Loyalty:** See `docs/qa-loyalty.md`; `/account/loyalty`; existing consumer_loyalty + webhook
- **Phase 7 — Affiliates:** (see Phase 7 spec; full implementation in follow-up)
- **Phase 8 — Vendor referrals:** (see Phase 8 spec; full implementation in follow-up)
- **Phase 9 — Discovery/leads/reviews:** As needed; existing discovery/reviews in place

## Hard rules (verify per phase)

- SSR auth: `getSession()` (not `getUser()`) in API routes.
- Protected data: server components fetch internal API with forwarded cookies.
- Base URL: `x-forwarded-proto` + `x-forwarded-host`, fallback `NEXT_PUBLIC_SITE_URL`, then `http://localhost:3000`.
- No secrets in logs; remove debug logs before final commit.
