# GATE-09 — Stripe Connect platform-approval verification

**Discovered:** 2026-05-12 during Phase 4 (Build #3) pre-flight
**Severity:** Procedural halt per CEO directive Phase 4 sub-gate
**Status:** Halting Phase 4 (Build #3) for one CEO ack OR Stripe MCP reconnection

## Why this halt exists

The CEO directive's Phase 4 sub-gate explicitly states:

> *"If Stripe Connect application/platform approval is not yet complete, HALT. Connect requires Stripe platform onboarding that the CEO must complete in the Stripe dashboard. **Verify via Stripe MCP: list_accounts or check Connect status.** If not approved, write GATE-05 with the exact Stripe dashboard URL the CEO needs to visit."*

**The Stripe MCP server is disconnected this session** (was marked as disconnected earlier in `<system-reminder>`). I cannot run `stripe.accounts.list` or check platform settings programmatically.

## What I CAN verify from the codebase

Strong indirect evidence that Stripe Connect platform IS approved:

1. **`STRIPE_CONNECT_CLIENT_ID` is configured** in env (visible as redacted line in `.env.local`).
2. **Live affiliate Connect runs in production**: `app/api/affiliates/connect/create-account/route.ts` calls `assertStripeLiveConfig()` and uses `stripe.accounts.create()` for Express accounts — this code is on `main` and is exercised by real users (the `affiliates` table has rows per the schema dump).
3. **Driver payouts use Connect transfers** via `lib/server/driverPayoutService.ts` — also production code.
4. **Affiliate payouts schema** (`affiliate_payouts` table from PR #171) has `stripe_transfer_id` column — implies real Connect transfers happen.

Conclusion: the platform is almost certainly approved. But the directive's sub-gate language is "verify," not "infer." I'm honoring the strict reading.

## What I need from CEO

**Pick one to unlock Phase 4:**

### Option A — One-line ack
> "Stripe Connect platform is approved. Proceed with Phase 4."

I take this as authorization and continue. The codebase evidence + your ack is sufficient.

### Option B — Reconnect Stripe MCP
Reconnect the Stripe MCP server (was named `mcp__eb7b9679-...` in the deferred tool list earlier this session). With it I can run `list_accounts`, `get_stripe_account_info`, etc. programmatically and verify in 5 seconds.

### Option C — You verify directly
Open https://dashboard.stripe.com/settings/connect and confirm:
1. Connect is enabled (not just "available")
2. Platform profile is approved (not pending review)
3. Express account creation is allowed

If anything's in pending state, write what's pending here and I'll wait.

## Why this matters for Phase 4

Phase 4 PR-A (schema migration adding `vendors.stripe_account_id` etc.) is safe regardless — it doesn't call Stripe APIs. I could ship PR-A unilaterally.

But Phase 4 PR-B (Connect onboarding flow) makes the first `stripe.accounts.create()` call. If the platform isn't actually approved, that call fails and any vendor who hits the new onboarding route gets a 500. Better to verify BEFORE writing any code.

## Parallel work that's NOT blocked by this gate

- **Build #5 (Regional Compliance Matrix, Phase 6)** — fully independent
- **Build #7 (Community feed)** — independent, but depends on catalog seed
- **Build #9 (8 service pages)** — independent
- **Build #10 (Jax episodes)** — independent

If the CEO wants me to start Phase 6 (Build #5) while this gate is open, I can do that without violating any sub-gates.

## Halts now open

| Gate | Status |
|---|---|
| GATE-08 — Ask JAX scope (Build #4) | Awaiting CEO option A/B/C |
| GATE-09 — Stripe Connect verification (Build #3) | Awaiting CEO ack OR MCP reconnection |
| HALT-CATALOG-SEED | Awaiting CEO catalog upload (Build #7 partial dep) |

**Awaiting CEO direction.**
