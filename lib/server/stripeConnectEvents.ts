/**
 * Server-side helpers for processing Stripe Connect webhook events.
 *
 * The webhook handler at /api/stripe/webhooks/connect calls these in sequence:
 *
 *   1. lookupVendorByAccountId(admin, stripe_account_id)
 *      → resolves the local vendor row from the connected-account ID on the event
 *
 *   2. logConnectEvent(admin, ...)
 *      → idempotent insert into stripe_connect_events keyed on Stripe's event_id
 *      → returns { firstSeen: true } on first arrival, { firstSeen: false }
 *        when the row already exists (Stripe retry → silent dedupe). The
 *        webhook responds 200 in both cases so Stripe stops retrying.
 *
 *   3. handler-specific logic (account.updated, payout.failed, etc.) using
 *      these helpers as building blocks.
 *
 *   4. markConnectEventProcessed(admin, event_id, outcome, errorMessage?)
 *      → stamps processed_at + processed_outcome + error_message on the log row
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ConnectEventOutcome = "ok" | "error" | "skipped";

type AdminLike = SupabaseClient | { from: (...args: unknown[]) => unknown };

/**
 * Resolve the local vendor row from a Stripe Connect account ID.
 *
 * vendor_connect_accounts.user_id ↔ vendors.owner_user_id is the join path.
 * Returns null when no local row exists for the account (event fired before
 * onboarding completed, or account belongs to another platform's vendor).
 */
export async function lookupVendorByAccountId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  stripe_account_id: string,
): Promise<{ vendor_id: string; user_id: string } | null> {
  if (!stripe_account_id) return null;
  const { data: connect } = await admin
    .from("vendor_connect_accounts")
    .select("user_id")
    .eq("stripe_account_id", stripe_account_id)
    .maybeSingle();
  if (!connect?.user_id) return null;
  const { data: vendor } = await admin
    .from("vendors")
    .select("id")
    .eq("owner_user_id", connect.user_id)
    .maybeSingle();
  if (!vendor?.id) return null;
  return { vendor_id: vendor.id, user_id: connect.user_id };
}

/**
 * Idempotent insert into stripe_connect_events.
 *
 * stripe_connect_events.event_id is the PRIMARY KEY (matches Stripe's
 * unique event_id), so a duplicate webhook (Stripe retry) is rejected by
 * the unique constraint with Postgres error code 23505. We treat that as
 * "already logged" and return firstSeen: false.
 */
export async function logConnectEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  params: {
    event_id: string;
    event_type: string;
    vendor_id: string | null;
    stripe_account_id: string | null;
    payload: unknown;
  },
): Promise<{ firstSeen: boolean }> {
  const { error } = await admin.from("stripe_connect_events").insert({
    event_id: params.event_id,
    event_type: params.event_type,
    vendor_id: params.vendor_id,
    stripe_account_id: params.stripe_account_id,
    payload: params.payload as Record<string, unknown>,
  });
  if (!error) return { firstSeen: true };
  // 23505 = unique_violation. Anything else is a real error we should surface.
  // PostgrestError shape: { code, message, details, hint }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const code = (error as any).code;
  if (code === "23505") return { firstSeen: false };
  throw new Error(`logConnectEvent insert failed: ${error.message ?? String(error)}`);
}

/**
 * Stamp processing outcome on a stripe_connect_events row. Safe to call
 * even on duplicate events — UPDATE on PK is idempotent and reflects the
 * latest attempt.
 */
export async function markConnectEventProcessed(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  event_id: string,
  outcome: ConnectEventOutcome,
  errorMessage?: string,
): Promise<void> {
  await admin
    .from("stripe_connect_events")
    .update({
      processed_at: new Date().toISOString(),
      processed_outcome: outcome,
      error_message: errorMessage ?? null,
    })
    .eq("event_id", event_id);
}

/**
 * Sync vendor_connect_accounts.charges_enabled + payouts_enabled +
 * payout_schedule_preference from a Stripe account object. Used by both
 * account.updated and capability.updated handlers.
 */
export async function syncConnectAccountStatus(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  stripe_account_id: string,
  // Permissive shape — accepts Stripe.Account directly (whose nested types
  // are more constrained) plus our test fixtures. Each field is defensively
  // type-checked before being included in the UPDATE.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  account: any,
): Promise<void> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof account?.charges_enabled === "boolean") updates.charges_enabled = account.charges_enabled;
  if (typeof account?.payouts_enabled === "boolean") updates.payouts_enabled = account.payouts_enabled;
  const interval = account?.settings?.payouts?.schedule?.interval;
  if (interval === "daily" || interval === "weekly" || interval === "monthly") {
    updates.payout_schedule_preference = interval;
  }
  await admin
    .from("vendor_connect_accounts")
    .update(updates)
    .eq("stripe_account_id", stripe_account_id);
}

/**
 * Extend held_until on platform_reserve rows for a disputed charge.
 *
 * Stripe dispute objects include the charge ID. We look up that charge's
 * order via metadata, then push held_until forward 30 days from now on
 * any non-released reserve rows for the affected order.
 *
 * Returns the number of rows extended (0 when no matching reserve exists,
 * which happens if the dispute is on a charge that pre-dates the reserve
 * system or whose reserve already released).
 */
export async function extendReserveForDispute(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  params: { order_id: string | null; dispute_id: string },
): Promise<number> {
  if (!params.order_id) return 0;
  const extensionDays = 30;
  const newHeldUntil = new Date(Date.now() + extensionDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await admin
    .from("platform_reserve")
    .select("id, held_until")
    .eq("order_id", params.order_id)
    .is("released_at", null);
  if (!existing || existing.length === 0) return 0;
  // Only extend rows whose current held_until is BEFORE the new one (don't
  // shorten an already-longer hold).
  const toExtend = (existing as { id: string; held_until: string }[]).filter(
    (r) => new Date(r.held_until).getTime() < Date.now() + extensionDays * 24 * 60 * 60 * 1000,
  );
  if (toExtend.length === 0) return 0;
  await admin
    .from("platform_reserve")
    .update({
      held_until: newHeldUntil,
      reason: "dispute_extension",
      notes: `Hold extended +${extensionDays}d due to Stripe dispute ${params.dispute_id}`,
      updated_at: new Date().toISOString(),
    })
    .in(
      "id",
      toExtend.map((r) => r.id),
    );
  return toExtend.length;
}
