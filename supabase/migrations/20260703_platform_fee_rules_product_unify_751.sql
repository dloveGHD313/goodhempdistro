-- P1-1 CEO decision (2026-07-03): unify PRODUCT commission to 7/5/1
-- across all three layers:
--   1. Pricing page copy (lib/pricing.ts) — was advertising Enterprise 0%,
--      corrected to 1% in the same PR
--   2. Checkout (lib/referral.ts COMMISSION_RATES) — already correct:
--      starter=700, mid=500, top=100 bps (matches April CEO-confirmed DB)
--   3. This post-payment ledger (platform_fee_rules, consumed by
--      applyPlatformFeesToOrder → order_items.platform_fee_cents →
--      admin analytics) — was stamping 500/400/300 for products
--
-- Scope: item_type='product' only. service / event_ticket / vendor_slot
-- rows are separate flows not covered by the 7/5/1 decision, deliberately
-- untouched. 'default' product row = starter rate (fallback for vendors
-- with no resolved plan).
--
-- Applied to production via Supabase MCP 2026-07-03. Idempotent.
update public.platform_fee_rules set fee_bps = 700 where item_type = 'product' and vendor_plan_type = 'starter' and fee_bps <> 700;
update public.platform_fee_rules set fee_bps = 500 where item_type = 'product' and vendor_plan_type = 'mid' and fee_bps <> 500;
update public.platform_fee_rules set fee_bps = 100 where item_type = 'product' and vendor_plan_type = 'top' and fee_bps <> 100;
update public.platform_fee_rules set fee_bps = 700 where item_type = 'product' and vendor_plan_type = 'default' and fee_bps <> 700;
