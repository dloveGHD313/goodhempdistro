# Phase 8 — Vendor Referrals (referrers, ledger, payouts, first-sale)

## Summary

- **Migration:** `072_vendor_referrals_phase8.sql` — `vendor_applications.referral_code`, `vendor_referrers`, `vendor_referrals`, `vendor_referral_reward_rules`, `vendor_referral_ledger`, `vendor_referral_payouts`, admin RLS.
- **Attribution:** Application stores `referral_code` (from ?vr= or cookie); on admin approve vendor, create signup referral + ledger. First paid order for referred vendor triggers first_sale referral + ledger (webhook).
- **APIs:** Vendor referral code (get/create), ledger, balance, payouts list, payouts/request; Admin vendor-referral payouts list and approve (Stripe Transfer to vendor Connect).
- **Routes:** `/vr/[code]` → `/vendor-registration?vr=code`; `/vendors/referrals` (portal); `/admin/vendor-referrals/payouts` (queue).

## Test URLs

| Flow | URL | Notes |
|------|-----|--------|
| Vendor referral redirect | `/vr/ABC123` | Redirects to `/vendor-registration?vr=ABC123`. |
| Vendor referrals portal | `/vendors/referrals` | Referral link, ledger, balance, request payout; link to Connect. |
| Admin vendor referral payouts | `/admin/vendor-referrals/payouts` | List requested; Approve (Stripe to vendor Connect). |

## Verification

- Run migration `072_vendor_referrals_phase8.sql`.
- Vendor: visit `/vendors/referrals` → get code → share `/vr/[code]`; when referred vendor is approved, referrer gets signup reward; when referred vendor’s first order is paid, referrer gets first_sale reward.
- Admin: approve vendor application (with referral_code) → signup referral + ledger; approve payout at `/admin/vendor-referrals/payouts` (vendor must have Connect).
