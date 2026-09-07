-- Widen subscriptions.status to Stripe's full subscription lifecycle.
-- Found by the first live checkout (2026-09-07): Stripe fires customer.subscription.created with
-- status='incomplete' before the invoice is paid; the webhook upsert hit
-- "subscriptions_status_check" and returned 500, so Stripe kept retrying the event.
-- Stripe statuses: incomplete, incomplete_expired, trialing, active, past_due, canceled, unpaid, paused.
-- Non-destructive: only adds allowed values ('pending' kept for legacy rows).

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status = ANY (ARRAY[
    'pending', 'incomplete', 'incomplete_expired', 'trialing', 'active',
    'past_due', 'canceled', 'unpaid', 'paused'
  ]));

-- consumer_subscriptions.subscription_status has no CHECK today; documenting the same set for reference.
COMMENT ON COLUMN public.subscriptions.status IS
  'Stripe subscription status (incomplete | incomplete_expired | trialing | active | past_due | canceled | unpaid | paused) or legacy pending';
