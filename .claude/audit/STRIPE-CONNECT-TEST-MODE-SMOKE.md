# Stripe Connect Test-Mode Smoke Checklist (Phase 4 verification)

**Audience:** CEO or operator with Stripe Dashboard access.
**Purpose:** end-to-end live validation against Stripe **test mode** that the funds-flow loop (PR-B → PR-D → PR-C) actually works against real Stripe APIs, not just unit/integration mocks.

This complements `__tests__/stripe-connect-flow-integration.test.ts` (mocked) by exercising the parts a unit test can't cover:
- Real Stripe webhook signature verification
- Real `stripe.accounts.create` + Account Link onboarding UX
- Real `stripe.checkout.sessions.create` with `payment_intent_data` destination charges
- Real `stripe.transfers.create` from the cron
- Real `account.updated` / `charge.dispute.created` events firing from Stripe to our webhook

## Pre-flight (one-time per environment)

- [ ] **Switch Stripe Dashboard to Test mode** (toggle, top-right)
- [ ] **Connect webhook endpoint exists in test mode** at `https://<preview-deploy>/api/stripe/webhooks/connect`
  - Events to listen for: `account.updated`, `capability.updated`, `payout.paid`, `payout.failed`, `transfer.created`, `transfer.reversed`, `charge.dispute.created`
  - **"Events on Connected accounts"** checkbox must be ON
- [ ] **Platform webhook endpoint exists in test mode** at `https://<preview-deploy>/api/webhooks/stripe`
  - Standard set including `checkout.session.completed`
- [ ] **Vercel env vars set for Preview + Development:**
  - `STRIPE_SECRET_KEY` = `sk_test_...`
  - `STRIPE_WEBHOOK_SECRET` = test platform-webhook signing secret
  - `STRIPE_CONNECT_WEBHOOK_SECRET` = test Connect-webhook signing secret
  - `CRON_SECRET` = any random string (gate for the release cron)
- [ ] **A test vendor exists** in production DB with `tier IN ('starter','mid','top')` and `status='active'`. Easiest: use the existing anchor vendor `debf6809-dbb4-4987-aabe-60c5fdf7ab49`.
- [ ] **A test product exists** for that vendor, `status='approved'`, `active=true`, `image_url` present.

## Smoke sequence

### 1. Connect onboarding

- [ ] Sign in as the test vendor → visit `/vendors/payouts`
- [ ] If unconnected: click **Connect Stripe** → complete Stripe-hosted Express onboarding using [test data](https://stripe.com/docs/connect/testing) (use SSN `000000000`, DOB any valid date, address `address_full_match`)
- [ ] Return to `/vendors/payouts`: status pill should read **Active**, with `charges_enabled` + `payouts_enabled` both **Yes**
- [ ] Click **Manage account** → expect redirect to Stripe Express dashboard, not 404

**Server-side verification:**
```
SELECT stripe_account_id, charges_enabled, payouts_enabled, payout_schedule_preference
FROM vendor_connect_accounts WHERE user_id = '<vendor user_id>';
```
Expect non-null stripe_account_id, both booleans = true.

### 2. Destination-charge checkout

- [ ] Sign in as a CONSUMER (different account) → place an order for the test product using Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP
- [ ] Order success page appears

**Server-side verification:**
```
SELECT id, status, total_cents, vendor_id FROM orders WHERE user_id = '<consumer user_id>' ORDER BY created_at DESC LIMIT 1;
```
Expect `status='paid'`.

**Stripe Dashboard verification (updated for P0-1 reserve-transfer model):**
- Test mode → Payments → most recent → confirm:
  - **Full amount settles on the PLATFORM account** — there must be **NO application fee and NO transfer at charge time** (the old destination-charge behavior double-paid vendors; see P0-1)
  - The Checkout Session metadata carries `platform_fee_cents` / `platform_fee_tier` / `platform_fee_bps`
- The ONLY vendor payment happens at step 4 (cron release). If you see a transfer to the vendor's account at charge time, the P0-1 fix is not deployed — STOP.

### 3. Reserve queued

- [ ] Wait ~30 seconds for the webhook to fire

```
SELECT id, vendor_id, order_id, amount_cents, reason, held_until, released_at
FROM platform_reserve WHERE order_id = '<order_id from step 2>';
```

Expect:
- 1 row exists
- `reason = 'order_completion'`
- `held_until ≈ now() + 7 days`
- `released_at IS NULL`
- `amount_cents` = (order.total_cents − Stripe application_fee_amount)

```
SELECT event_id, event_type, processed_outcome FROM stripe_connect_events ORDER BY created_at DESC LIMIT 5;
```
Expect the related `transfer.created` event already logged with `processed_outcome='ok'`.

### 4. Release cron — manual trigger (fast-forward)

To verify the cron without waiting 7 days, temporarily UPDATE the reserve row to set `held_until` in the past:

```
UPDATE platform_reserve
SET held_until = now() - interval '1 minute'
WHERE order_id = '<order_id>';
```

Then invoke the cron manually:
```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://<preview-deploy>/api/cron/release-reserves
```

Expect JSON response with `summary.released >= 1`.

**Verify:**
```
SELECT id, released_at, released_to_stripe_transfer_id
FROM platform_reserve WHERE order_id = '<order_id>';
```
- `released_at` is non-null and recent
- `released_to_stripe_transfer_id` matches a real `tr_test_...` ID

**Stripe Dashboard:** Test mode → Connect → that test vendor's account → Transfers → confirm the new `tr_test_...` shows up.

### 5. Idempotency replay

- [ ] Re-invoke the cron immediately (same curl). Expect `summary.released = 0` (no duplicate transfer — `released_at IS NULL` filter excludes the row).
- [ ] Stripe Dashboard: only one transfer exists for this reserve (no double-send).
- [ ] Resend the original `checkout.session.completed` webhook from Stripe Dashboard → check `platform_reserve` count for that `order_id` still = 1 (de-dupe on `vendor_id + order_id + reason`).

### 6. Dispute → hold extension

- [ ] In Stripe Dashboard → Payments → the test payment → click `... → Dispute payment` to simulate a dispute (test mode supports this)
- [ ] Wait ~30 seconds

**Verify:**
```
SELECT id, held_until, reason, notes FROM platform_reserve WHERE order_id = '<order_id>';
```
Expect:
- `held_until` is now ~30 days from now (was already-released `released_at` may still be non-null from step 4; in that case, this checks behavior on a FRESH order — repeat steps 2-3 with a new order before this step if step 4 already released)
- `reason = 'dispute_extension'`
- `notes` contains the dispute ID

```
SELECT event_type, processed_outcome FROM stripe_connect_events WHERE event_type = 'charge.dispute.created' ORDER BY created_at DESC LIMIT 1;
```
Expect `processed_outcome='ok'`.

### 7. Payout failure handling (optional, ad-hoc)

Hard to trigger in test mode without artificial setup; skip unless investigating a specific case.

## What success looks like

✅ Connect onboarding completes; account shows Active in `/vendors/payouts`
✅ Checkout fires application_fee + transfer to vendor's Connect account
✅ Reserve row queued with 7-day hold
✅ Cron releases funds via `stripe.transfers.create` after hold elapses
✅ Replay does not double-transfer (idempotency)
✅ Dispute extends hold by +30 days
✅ All Connect events logged to `stripe_connect_events` with `processed_outcome='ok'`

## What failure looks like

❌ Onboarding loops without completing → check that `STRIPE_CONNECT_CLIENT_ID` is **NOT** required (Account Links don't use it; only OAuth does)
❌ No application_fee on the payment → check `PR-B` is in main and `vendor_connect_accounts.charges_enabled=true`
❌ No reserve row queued → check the platform webhook logs for `[reserve] queued ...` lines
❌ Cron returns 401 → `CRON_SECRET` mismatch
❌ Cron `summary.errored > 0` → check Vercel logs for `transfers.create` failures (usually `insufficient_funds` on platform balance in test mode → see [Stripe test mode balance docs](https://stripe.com/docs/connect/testing#balances))

## After full smoke passes

- [ ] CEO greenlights Phase 4 closure
- [ ] Add `STRIPE_CONNECT_WEBHOOK_SECRET` to **Production** scope (currently Preview+Dev only)
- [ ] Add `CRON_SECRET` to **Production** scope
- [ ] Move on to Phase 5 (Build #4 Ask JAX thin wrapper)

---

**Notes for the smoke runner:**

- Use the preview deployment, not production. Vercel preview URLs hot-rebuild every PR merge so the latest code is live within ~2 min.
- The whole smoke takes ~15-30 minutes the first time. After the test vendor's Connect account is onboarded once, subsequent runs are fast (just checkout + reserve + cron + dispute).
- All operations against `sk_test_...` keys. No real money moves.
