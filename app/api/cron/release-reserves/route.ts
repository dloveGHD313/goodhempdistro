import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  findDueReserves,
  markReserveReleased,
  resolveDestinationAccount,
} from "@/lib/server/platformReserve";

/**
 * Daily cron — releases platform_reserve rows whose 7-day hold has elapsed.
 *
 * For each due row:
 *   1. Resolve the vendor's Stripe Connect account ID. Skip when missing
 *      or when charges/payouts aren't both enabled (KYC incomplete).
 *   2. Create a Stripe transfer for the reserved amount with the order_id
 *      in transfer metadata (audit trail).
 *   3. Stamp released_at + released_to_stripe_transfer_id on the row.
 *
 * Failures don't poison the batch — each row is independent. A row that
 * fails this tick stays unreleased and the next cron tick retries it.
 *
 * Authentication: requires the Vercel-cron Authorization header
 * `Bearer <CRON_SECRET>`. The same secret is configured in the Vercel cron
 * definition so legitimate cron invocations pass. Manual operator runs use
 * the same header. Returns 401 on missing/wrong secret.
 *
 * Idempotency: every successful transfer stamps released_at, so the row is
 * filtered out on subsequent ticks via `released_at IS NULL`. Even if Stripe
 * idempotency keys lapse, this guards against double-transfers.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const ROUTE_NAME = "cron/release-reserves";
const BATCH_LIMIT = 50;

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

type ReleaseResult = {
  reserve_id: string;
  vendor_id: string;
  order_id: string | null;
  amount_cents: number;
  outcome: "released" | "skipped_no_account" | "skipped_disabled" | "error";
  transfer_id?: string;
  error?: string;
};

export async function POST(req: NextRequest) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    console.error(`[${ROUTE_NAME}] CRON_SECRET not configured`);
    return NextResponse.json({ error: "CRON_SECRET missing" }, { status: 500 });
  }
  const got = req.headers.get("authorization") ?? "";
  if (got !== `Bearer ${expected}`) {
    return unauthorized();
  }

  return runReleaseSweep();
}

// Vercel cron POSTs but allow GET for manual operator runs from a browser
// (still requires the bearer secret).
export async function GET(req: NextRequest) {
  return POST(req);
}

async function runReleaseSweep(): Promise<NextResponse> {
  const startedAt = Date.now();
  const admin = getSupabaseAdminClient();

  let due;
  try {
    due = await findDueReserves(admin, BATCH_LIMIT);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${ROUTE_NAME}] findDueReserves failed`, { message });
    return NextResponse.json({ error: "failed to query due reserves", message }, { status: 500 });
  }

  console.log(`[${ROUTE_NAME}] sweep start: ${due.length} due reserves`);

  const results: ReleaseResult[] = [];

  for (const row of due) {
    const base: ReleaseResult = {
      reserve_id: row.id,
      vendor_id: row.vendor_id,
      order_id: row.order_id,
      amount_cents: row.amount_cents,
      outcome: "error",
    };

    let destination: string | null;
    try {
      destination = await resolveDestinationAccount(admin, row.vendor_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ ...base, outcome: "error", error: `resolveDestinationAccount: ${message}` });
      continue;
    }

    if (!destination) {
      results.push({ ...base, outcome: "skipped_no_account" });
      console.warn(`[${ROUTE_NAME}] skip reserve=${row.id} vendor=${row.vendor_id} — no Connect account or capabilities disabled`);
      continue;
    }

    let transferId: string;
    try {
      // Use the reserve UUID as an idempotency key so retries from the same
      // cron run never double-transfer. Stripe idempotency expires after 24h.
      const transfer = await stripe.transfers.create(
        {
          amount: row.amount_cents,
          currency: "usd",
          destination,
          metadata: {
            reserve_id: row.id,
            vendor_id: row.vendor_id,
            order_id: row.order_id ?? "",
            source: "platform_reserve_release_cron",
          },
        },
        { idempotencyKey: `reserve-release-${row.id}` },
      );
      transferId = transfer.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ ...base, outcome: "error", error: `transfers.create: ${message}` });
      console.error(`[${ROUTE_NAME}] transfer failed reserve=${row.id}`, { message });
      continue;
    }

    try {
      await markReserveReleased(admin, row.id, transferId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Transfer succeeded but our local stamp failed. The transfer is real
      // and the idempotency key prevents double-send on next tick (within 24h).
      // Surface loudly so operator can manually stamp.
      console.error(`[${ROUTE_NAME}] TRANSFER MADE BUT DB STAMP FAILED reserve=${row.id} transfer=${transferId}`, { message });
      results.push({ ...base, outcome: "error", transfer_id: transferId, error: `markReserveReleased: ${message}` });
      continue;
    }

    results.push({ ...base, outcome: "released", transfer_id: transferId });
    console.log(`[${ROUTE_NAME}] released reserve=${row.id} vendor=${row.vendor_id} amount=${row.amount_cents}c transfer=${transferId}`);
  }

  const summary = {
    duration_ms: Date.now() - startedAt,
    total_due: due.length,
    released: results.filter((r) => r.outcome === "released").length,
    skipped_no_account: results.filter((r) => r.outcome === "skipped_no_account").length,
    errored: results.filter((r) => r.outcome === "error").length,
  };

  console.log(`[${ROUTE_NAME}] sweep end`, summary);

  return NextResponse.json({ ok: true, summary, results });
}
