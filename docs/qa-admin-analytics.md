# QA — Admin Analytics (Phase 5)

Admin revenue and performance dashboard: GMV, platform revenue, orders count, AOV, top vendors, top items, time series.

## Requirements

- **Auth:** APIs use requireAdminUsers(req) (admin_users table).
- **Overview:** GET /api/admin/analytics/overview → gmv_cents, platform_revenue_cents, orders_count, aov_cents.
- **Timeseries:** GET /api/admin/analytics/timeseries?bucket=daily|monthly → series[] with date, gmv_cents, fee_cents, count.
- **Top vendors:** GET /api/admin/analytics/top-vendors → data[] vendor_user_id, business_name, gmv_cents, fee_cents.
- **Top items:** GET /api/admin/analytics/top-items?type=product|service|event_ticket|vendor_slot → data[] item_id, gmv_cents.

## UI

- **/admin/analytics:** Admin gate (requireAdmin). Client fetches overview, timeseries, top-vendors, top-items; displays cards + tables (fallback; no chart lib required).

## Manual verification

1. Log in as admin (in admin_users).
2. Open /admin/analytics; confirm overview cards and tables load.
3. Log in as non-admin; open /admin/analytics → redirect or 403 on API calls.

## Build

After Phase 5: `npm run build` must pass.
