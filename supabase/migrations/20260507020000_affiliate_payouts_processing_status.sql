-- Add 'processing' to affiliate_payouts status CHECK.
-- Required by /api/admin/payouts/trigger workflow which sets the row to
-- 'processing' before sending the Stripe transfer (and reverts to 'pending'
-- on failure). Without this, the trigger 500s on first claim update.

alter table public.affiliate_payouts
  drop constraint if exists affiliate_payouts_status_check;

alter table public.affiliate_payouts
  add constraint affiliate_payouts_status_check
  check (status in ('pending','processing','requested','approved','paid','rejected','forfeited'));
