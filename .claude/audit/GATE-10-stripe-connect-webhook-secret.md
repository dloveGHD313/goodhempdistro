# GATE-10 — Stripe Connect webhook secret not configured

**Discovered:** 2026-05-12 during Phase 4 PR-C pre-flight
**Severity:** Procedural halt per directive Phase 4 PR-C sub-gate
**Status:** Halting PR-C until CEO adds the env var

## Why this halt exists

Directive PR-C sub-gate states:

> *"Test mode webhook secret: `STRIPE_CONNECT_WEBHOOK_SECRET` (separate from existing webhook secret — verify env var exists). If `STRIPE_CONNECT_WEBHOOK_SECRET` is not in Vercel env yet, HALT and write GATE-10 noting the CEO needs to add it from Stripe Dashboard → Developers → Webhooks → Connect endpoint."*

`STRIPE_CONNECT_WEBHOOK_SECRET` is **not** present in `.env.local`. Only the existing `STRIPE_WEBHOOK_SECRET` (platform-account webhook for invoices, subscriptions, etc.) exists. They serve different purposes:

| Secret | Stripe endpoint | Event scope |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET` (✅ exists) | Platform-account webhook | `invoice.*`, `customer.subscription.*`, `checkout.session.completed`, etc. — events on the GHD platform Stripe account |
| `STRIPE_CONNECT_WEBHOOK_SECRET` (❌ missing) | **Connect** webhook | `account.updated`, `capability.updated`, `payout.*`, `transfer.*`, `charge.dispute.*` — events on **Connected accounts** (vendors' Stripe accounts) |

Stripe routes Connect events to a separate endpoint URL with its own signing secret. Using the platform-account secret to verify Connect-event signatures will fail.

## What CEO needs to do

Add `STRIPE_CONNECT_WEBHOOK_SECRET` to Vercel env (and `.env.local` for local dev):

1. **Stripe Dashboard** → https://dashboard.stripe.com/webhooks
2. Click **+ Add endpoint**
3. **Endpoint URL:** `https://www.goodhempdistro.com/api/stripe/webhooks/connect`
   - (This route doesn't exist yet — I'll create it in PR-C once the secret is configured. Stripe accepts the URL even if it 404s during creation; it'll start working after PR-C ships.)
4. **Events on Connected accounts:** ✅ check the box (this is what makes it a Connect webhook)
5. **Listen to events:**
   - `account.updated`
   - `capability.updated`
   - `payout.failed`
   - `payout.paid`
   - `transfer.created`
   - `transfer.reversed`
   - `charge.dispute.created`
6. **Click "Add endpoint"**
7. Copy the **signing secret** (starts with `whsec_`)
8. **Vercel Dashboard** → Project Settings → Environment Variables → Add:
   - Name: `STRIPE_CONNECT_WEBHOOK_SECRET`
   - Value: the `whsec_...` you just copied
   - Environments: Production, Preview, Development
9. (Optional) Update local `.env.local` with the same value so I can verify the secret loads correctly

**Heads up: Stripe also requires you to create this endpoint in *test mode* separately** (top-right of Stripe Dashboard). Two endpoints, two secrets — for live and test. Per directive: test mode for development.

If you'd prefer to ship to test mode only first:
- Switch Stripe Dashboard to **Test mode** (toggle top-right)
- Create the test-mode webhook endpoint
- Copy the test-mode `whsec_test_...`
- Set Vercel env var `STRIPE_CONNECT_WEBHOOK_SECRET` to the test secret for **Preview + Development** environments only
- Production env stays empty for now (Connect webhook handler will fail-closed in production until live secret is added)

## What I'll do once the secret lands

Reply to this PR with "secret added" or similar, and I'll:

1. Create `/api/stripe/webhooks/connect/route.ts` with signature verification using the new env var
2. Implement the 7 event handlers per directive (account.updated, capability.updated, payout.failed/paid, transfer.created/reversed, charge.dispute.created)
3. Idempotent logging via `stripe_connect_events.event_id` PK
4. Build + test + push as PR-C

## What's NOT blocked by this gate

PR-E (vendor dashboard payouts extension) reads from `platform_reserve` + `vendor_connect_accounts` — both schema is ready (PR-A). I can build PR-E in parallel while you set up the webhook, since the UI just needs the tables to exist (even if empty).

PR-D (daily cron release reserves) depends on PR-C populating the reserves table, so it stays blocked.

## Recommended path forward

Option A — sequential, simple:
- CEO adds `STRIPE_CONNECT_WEBHOOK_SECRET` → I unblock PR-C → PR-D → PR-E → PR-F

Option B — parallel, faster:
- I start PR-E now (vendor dashboard reads from tables, no webhook dependency)
- In parallel, CEO adds the secret
- When secret lands, I do PR-C → PR-D
- PR-F tests at the end

**Awaiting CEO direction.** Recommend Option B for throughput.

## Halts currently open

| Gate | Status |
|---|---|
| **GATE-10** (this one) | Stripe Connect webhook secret not configured |
| HALT-CATALOG-SEED | CEO uploading 78-SKU apparel CSV (informational; not blocking Phase 4) |
