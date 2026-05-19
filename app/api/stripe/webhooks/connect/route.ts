import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import {
  extendReserveForDispute,
  logConnectEvent,
  lookupVendorByAccountId,
  markConnectEventProcessed,
  syncConnectAccountStatus,
} from "@/lib/server/stripeConnectEvents";

/**
 * Stripe Connect webhook endpoint — events on CONNECTED accounts (vendor
 * Stripe accounts), separate from the platform-account webhook at
 * /api/webhooks/stripe.
 *
 * Setup: Stripe Dashboard → Webhooks → Add endpoint, check "Events on
 * Connected accounts", listen for: account.updated, capability.updated,
 * payout.failed, payout.paid, transfer.created, transfer.reversed,
 * charge.dispute.created. Signing secret goes in STRIPE_CONNECT_WEBHOOK_SECRET.
 *
 * Idempotency: every event is logged to stripe_connect_events with
 * Stripe's event_id as PK. Duplicate retries from Stripe hit the unique
 * constraint and we respond 200 to stop them.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // Stripe webhook signature uses Node crypto

const ROUTE_NAME = "stripe/webhooks/connect";

type ConnectEventHandler = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  event: Stripe.Event,
  vendorId: string | null,
) => Promise<{ outcome: "ok" | "skipped"; note?: string }>;

const HANDLERS: Record<string, ConnectEventHandler> = {
  "account.updated": async (admin, event) => {
    const account = event.data.object as Stripe.Account;
    await syncConnectAccountStatus(admin, account.id, account);
    return { outcome: "ok", note: `synced charges_enabled=${account.charges_enabled} payouts_enabled=${account.payouts_enabled}` };
  },

  "capability.updated": async (admin, event) => {
    // capability.updated fires when KYC capabilities change (e.g. tax,
    // transfers, card_payments). We re-fetch the parent account to get
    // the current charges_enabled / payouts_enabled snapshot.
    const cap = event.data.object as Stripe.Capability;
    if (!cap.account || typeof cap.account !== "string") return { outcome: "skipped", note: "no account on capability" };
    const account = await stripe.accounts.retrieve(cap.account);
    await syncConnectAccountStatus(admin, account.id, account);
    return { outcome: "ok", note: `capability ${cap.id} → ${cap.status}, account synced` };
  },

  "payout.paid": async (admin, event, vendorId) => {
    // Log only — the reserve cron (PR-D) is the authoritative releaser.
    // payout.paid fires when Stripe successfully sends funds from the
    // connected account to the vendor's bank.
    const payout = event.data.object as Stripe.Payout;
    return {
      outcome: "ok",
      note: `payout ${payout.id} paid: ${payout.amount} ${payout.currency} to bank vendor=${vendorId ?? "unknown"}`,
    };
  },

  "payout.failed": async (admin, event, vendorId) => {
    const payout = event.data.object as Stripe.Payout;
    // Failures are notable but acting on them is a future concern (PR-D or
    // vendor-notification follow-up). The event is durably logged here.
    console.error(`[${ROUTE_NAME}] payout.failed`, {
      payout_id: payout.id,
      amount: payout.amount,
      currency: payout.currency,
      failure_code: payout.failure_code,
      failure_message: payout.failure_message,
      vendor_id: vendorId,
    });
    return {
      outcome: "ok",
      note: `payout ${payout.id} failed: ${payout.failure_code ?? "unknown"}`,
    };
  },

  "transfer.created": async (admin, event, vendorId) => {
    const transfer = event.data.object as Stripe.Transfer;
    return {
      outcome: "ok",
      note: `transfer ${transfer.id} created: ${transfer.amount} ${transfer.currency} → ${transfer.destination as string} vendor=${vendorId ?? "unknown"}`,
    };
  },

  "transfer.reversed": async (admin, event, vendorId) => {
    const transfer = event.data.object as Stripe.Transfer;
    // Rare. Log + alert. Future PR could re-create the platform_reserve row.
    console.warn(`[${ROUTE_NAME}] transfer.reversed`, {
      transfer_id: transfer.id,
      amount_reversed: transfer.amount_reversed,
      vendor_id: vendorId,
    });
    return {
      outcome: "ok",
      note: `transfer ${transfer.id} reversed: ${transfer.amount_reversed}`,
    };
  },

  "charge.dispute.created": async (admin, event, vendorId) => {
    const dispute = event.data.object as Stripe.Dispute;
    // Trace dispute → charge → order. Stripe charge metadata is the source
    // of order_id (we set it at checkout). When the charge isn't expanded
    // we fetch it.
    let chargeId: string | null = null;
    if (typeof dispute.charge === "string") chargeId = dispute.charge;
    else if (dispute.charge && typeof dispute.charge === "object") chargeId = (dispute.charge as Stripe.Charge).id;

    let orderId: string | null = null;
    if (chargeId) {
      try {
        const charge = await stripe.charges.retrieve(chargeId);
        orderId = (charge.metadata?.order_id as string | undefined) ?? null;
      } catch (err) {
        console.warn(`[${ROUTE_NAME}] dispute charge retrieve failed`, {
          charge_id: chargeId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const extended = await extendReserveForDispute(admin, {
      order_id: orderId,
      dispute_id: dispute.id,
    });

    return {
      outcome: "ok",
      note: `dispute ${dispute.id} on charge ${chargeId ?? "?"} (order ${orderId ?? "?"}); extended ${extended} reserve row(s) vendor=${vendorId ?? "unknown"}`,
    };
  },
};

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "STRIPE_CONNECT_WEBHOOK_SECRET is not set. Add it to Vercel env from the Connect webhook endpoint's signing secret in Stripe Dashboard.",
    );
  }
  if (!secret.startsWith("whsec_")) {
    throw new Error("STRIPE_CONNECT_WEBHOOK_SECRET must start with whsec_");
  }
  return secret;
}

export async function POST(req: NextRequest) {
  const requestId = `cwh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  let event: Stripe.Event;
  try {
    const signature = req.headers.get("stripe-signature") ?? "";
    const body = await req.text();
    if (!signature) {
      return NextResponse.json({ error: "missing stripe-signature header" }, { status: 400 });
    }
    const secret = getWebhookSecret();
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${ROUTE_NAME}] signature verification failed`, { message, requestId });
    return NextResponse.json({ error: "signature verification failed" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // Resolve the vendor (if any) from the connected-account ID on the event.
  // Stripe Connect events carry `account` at the event root (the connected
  // account that produced the event). Falls back to scanning the data object
  // for an `account` field for capability.updated which lives inside data.
  const account_id_from_event =
    (event as Stripe.Event & { account?: string }).account
    ?? (event.data.object as { account?: string }).account
    ?? null;

  let vendorId: string | null = null;
  let vendorUserId: string | null = null;
  if (account_id_from_event) {
    const v = await lookupVendorByAccountId(admin, account_id_from_event);
    vendorId = v?.vendor_id ?? null;
    vendorUserId = v?.user_id ?? null;
  }

  // Idempotent log. Duplicate event_id → respond 200, skip handler.
  let firstSeen = true;
  try {
    const result = await logConnectEvent(admin, {
      event_id: event.id,
      event_type: event.type,
      vendor_id: vendorId,
      stripe_account_id: account_id_from_event,
      payload: event as unknown,
    });
    firstSeen = result.firstSeen;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${ROUTE_NAME}] event log insert failed`, { event_id: event.id, message, requestId });
    return NextResponse.json({ error: "event log insert failed" }, { status: 500 });
  }

  if (!firstSeen) {
    console.info(`[${ROUTE_NAME}] duplicate event (retry)`, { event_id: event.id, type: event.type, requestId });
    return NextResponse.json({ received: true, duplicate: true });
  }

  const handler = HANDLERS[event.type];
  if (!handler) {
    // Unrecognized event types are logged and skipped — not an error since
    // Stripe may send events we haven't subscribed to via dashboard config.
    await markConnectEventProcessed(admin, event.id, "skipped", `no handler for ${event.type}`);
    console.info(`[${ROUTE_NAME}] no handler`, { type: event.type, event_id: event.id, requestId });
    return NextResponse.json({ received: true, handled: false });
  }

  try {
    console.info(`[${ROUTE_NAME}] handling`, { type: event.type, event_id: event.id, vendor_id: vendorId, requestId });
    const result = await handler(admin, event, vendorId);
    await markConnectEventProcessed(admin, event.id, result.outcome);
    console.info(`[${ROUTE_NAME}] handled`, {
      type: event.type,
      event_id: event.id,
      outcome: result.outcome,
      note: result.note,
      requestId,
    });
    return NextResponse.json({ received: true, handled: true, outcome: result.outcome });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${ROUTE_NAME}] handler failed`, {
      type: event.type,
      event_id: event.id,
      vendor_id: vendorId,
      message,
      requestId,
    });
    // Stamp the row but still return 200 so Stripe doesn't retry indefinitely.
    // Operator can re-process from the log if needed.
    await markConnectEventProcessed(admin, event.id, "error", message);
    return NextResponse.json({ received: true, handled: false, error: message }, { status: 200 });
  }
}
