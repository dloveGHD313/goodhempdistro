# Phase 7 — Affiliates (ledger, payouts, Connect, portal)

## Summary

- **Migration:** `071_affiliates_phase7.sql` — `affiliates.stripe_account_id`, `affiliate_reward_rules`, `affiliate_ledger`, `affiliate_payouts`, admin RLS, `affiliate_ledger.payout_id`.
- **Webhook:** Referral tracking creates `affiliate_referrals` + `affiliate_ledger` (status `available`); uses admin client for DB writes.
- **APIs:** Affiliate Connect (create-account, onboard-link, status), ledger, balance, payouts list, payouts/request; Admin payouts list and payouts/[id]/approve (Stripe Transfer).
- **Routes:** `/r/[code]` → `/?ref=code`; `/affiliates/portal` (ledger, balance, request payout, Connect); `/admin/affiliates/payouts` (queue + Approve).

## Test URLs

| Flow | URL | Notes |
|------|-----|--------|
| Referral redirect | `/r/ABC123` | Redirects to `/?ref=ABC123` (client captures ref). |
| Affiliate page | `/affiliate` | Referral link + link to portal. |
| Affiliate portal | `/affiliates/portal` | Ledger, balance, request payout, Stripe Connect. |
| Admin affiliates | `/admin/affiliates` | Link to Payout queue. |
| Admin payout queue | `/admin/affiliates/payouts` | List requested payouts; Approve (Stripe Transfer). |

## Verification

- Run migration `071_affiliates_phase7.sql` (after 067–069).
- Affiliate: visit `/affiliate` → get code → visit `/affiliates/portal` → see balance/ledger, request payout, Connect with Stripe.
- Admin: visit `/admin/affiliates/payouts` → see requested payouts; Approve when affiliate has Connect (Stripe Transfer created, ledger marked paid).
