/**
 * Platform-reserve lifecycle helpers — companion to
 * lib/server/stripeConnectEvents.ts (which handles Connect-side webhooks).
 *
 * Architecture (CEO directive, Phase 4):
 *
 *   1. CHECKOUT — product purchase completes via destination charge
 *      (PR-B). On checkout.session.completed, the platform webhook calls
 *      queueOrderReserve() to write a platform_reserve row with
 *      held_until = now + 7 days, reason = order_completion. The amount
 *      reserved is the VENDOR'S NET portion (subtotal - platform fee).
 *
 *   2. DISPUTE — charge.dispute.created webhook (PR-C) calls
 *      extendReserveForDispute() in stripeConnectEvents.ts, which pushes
 *      held_until forward 30 days on affected rows.
 *
 *   3. RELEASE — daily cron at /api/cron/release-reserves (this PR) calls
 *      releaseDueReserves(). For each row where held_until <= now() AND
 *      released_at is null AND the vendor's Connect account is healthy:
 *      stripe.transfers.create(...) sends the held amount to the vendor's
 *      Connect account; we stamp released_at + released_to_stripe_transfer_id.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ReserveQueueParams = {
  vendor_id: string;
  order_id: string;
  /** Vendor net cents (subtotal − platform fee). Cannot exceed subtotal. */
  amount_cents: number;
  /** Days to hold. Defaults to 7 per CEO directive. */
  hold_days?: number;
  /** Optional context note shown in admin/vendor UIs. */
  notes?: string | null;
};

/**
 * Insert a platform_reserve row for a freshly-paid order.
 *
 * Idempotency: we de-dupe on (vendor_id, order_id, reason="order_completion").
 * If a row already exists we skip — webhooks may retry and we don't want
 * double-holds on the same order.
 *
 * Returns the new row ID on insert, null on skip (already queued), or
 * throws on real DB errors.
 */
export async function queueOrderReserve(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  params: ReserveQueueParams,
): Promise<{ id: string } | null> {
  if (!params.vendor_id || !params.order_id) {
    throw new Error("queueOrderReserve: vendor_id and order_id are required");
  }
  if (!Number.isFinite(params.amount_cents) || params.amount_cents <= 0) {
    // Zero-amount reserves are a no-op (e.g., free orders or 100% fee).
    return null;
  }

  // De-dupe check: existing order_completion row for this (vendor, order)?
  const { data: existing } = await admin
    .from("platform_reserve")
    .select("id")
    .eq("vendor_id", params.vendor_id)
    .eq("order_id", params.order_id)
    .eq("reason", "order_completion")
    .maybeSingle();

  if (existing?.id) {
    return null;
  }

  const holdDays = Number.isFinite(params.hold_days) && (params.hold_days as number) > 0
    ? (params.hold_days as number)
    : 7;
  const heldUntil = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: inserted, error } = await admin
    .from("platform_reserve")
    .insert({
      vendor_id: params.vendor_id,
      order_id: params.order_id,
      amount_cents: params.amount_cents,
      reason: "order_completion",
      held_until: heldUntil,
      notes: params.notes ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`queueOrderReserve insert failed: ${error.message ?? String(error)}`);
  }
  return inserted ? { id: inserted.id as string } : null;
}

type DueReserveRow = {
  id: string;
  vendor_id: string;
  order_id: string | null;
  amount_cents: number;
  held_until: string;
};

/**
 * Find platform_reserve rows whose hold has elapsed.
 *
 * Filters: released_at is null AND held_until <= now() AND amount_cents > 0.
 * Limit applied so a single cron tick doesn't try to release thousands at
 * once — successive ticks pick up the rest.
 */
export async function findDueReserves(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  limit = 50,
): Promise<DueReserveRow[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from("platform_reserve")
    .select("id, vendor_id, order_id, amount_cents, held_until")
    .is("released_at", null)
    .lte("held_until", nowIso)
    .gt("amount_cents", 0)
    .order("held_until", { ascending: true })
    .limit(limit);
  if (error) {
    throw new Error(`findDueReserves query failed: ${error.message ?? String(error)}`);
  }
  return (data ?? []) as DueReserveRow[];
}

/**
 * Resolve the destination Connect account for a vendor + sanity-check
 * that charges/payouts are still enabled. Returns null when not eligible
 * (vendor has no Connect account, or onboarding hasn't been completed).
 */
export async function resolveDestinationAccount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  vendor_id: string,
): Promise<string | null> {
  const { data: vendor } = await admin
    .from("vendors")
    .select("owner_user_id")
    .eq("id", vendor_id)
    .maybeSingle();
  if (!vendor?.owner_user_id) return null;

  const { data: connect } = await admin
    .from("vendor_connect_accounts")
    .select("stripe_account_id, charges_enabled, payouts_enabled")
    .eq("user_id", vendor.owner_user_id)
    .maybeSingle();
  if (!connect?.stripe_account_id) return null;
  if (!connect.charges_enabled || !connect.payouts_enabled) return null;
  return connect.stripe_account_id;
}

/**
 * Stamp a platform_reserve row as released.
 */
export async function markReserveReleased(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  id: string,
  stripe_transfer_id: string,
): Promise<void> {
  const { error } = await admin
    .from("platform_reserve")
    .update({
      released_at: new Date().toISOString(),
      released_to_stripe_transfer_id: stripe_transfer_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    throw new Error(`markReserveReleased failed for ${id}: ${error.message ?? String(error)}`);
  }
}
