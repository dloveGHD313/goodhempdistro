/**
 * Stripe API version-drift compatibility helpers.
 *
 * lib/stripe/server.ts pins apiVersion "2024-11-20.acacia", but the LIVE
 * webhook endpoint delivers payloads at the API version configured in the
 * Stripe Dashboard, which may be newer. Two breaking shape changes bit us
 * in production (2026-07-03, P0-0):
 *
 *   1. `subscription.current_period_end` no longer exists at the top level
 *      in newer versions — it moved to
 *      `subscription.items.data[0].current_period_end`. Calling
 *      `new Date(undefined * 1000).toISOString()` throws
 *      `RangeError: Invalid time value` → webhook 500s → Stripe retries
 *      forever → renewals/cancellations/downgrades never sync to the DB.
 *
 *   2. `invoice.subscription` is absent in newer payloads — the reference
 *      moved to `invoice.parent.subscription_details.subscription`.
 *
 * RULE for this codebase: never call `.toISOString()` on an unvalidated
 * Stripe timestamp. Route ALL subscription-period reads through
 * getSubPeriodEndISO() and ALL invoice→subscription reads through
 * resolveInvoiceSubscriptionId(). Both tolerate old AND new payload shapes
 * and return null when the field is genuinely absent — DB writes must
 * tolerate null.
 */

import type Stripe from "stripe";

/**
 * Extract current_period_end from a subscription in either API shape.
 * Returns ISO-8601 string, or null when no finite numeric timestamp exists.
 */
export function getSubPeriodEndISO(sub: Stripe.Subscription): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ts = (sub as any).current_period_end
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ?? (sub as any).items?.data?.[0]?.current_period_end
    ?? null;
  return typeof ts === "number" && Number.isFinite(ts)
    ? new Date(ts * 1000).toISOString()
    : null;
}

/**
 * Extract current_period_start from a subscription in either API shape.
 * Same version-drift as current_period_end — moved to items.data[0] in
 * newer API versions. Returns ISO-8601 string or null.
 */
export function getSubPeriodStartISO(sub: Stripe.Subscription): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ts = (sub as any).current_period_start
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ?? (sub as any).items?.data?.[0]?.current_period_start
    ?? null;
  return typeof ts === "number" && Number.isFinite(ts)
    ? new Date(ts * 1000).toISOString()
    : null;
}

/**
 * Resolve the subscription ID from an invoice in either API shape.
 * Old: `invoice.subscription` (string or expanded object).
 * New: `invoice.parent.subscription_details.subscription`.
 * Returns the ID string, or null when the invoice has no subscription.
 */
export function resolveInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacy = (invoice as any).subscription;
  if (typeof legacy === "string" && legacy) return legacy;
  if (legacy && typeof legacy === "object" && typeof legacy.id === "string") return legacy.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modern = (invoice as any).parent?.subscription_details?.subscription;
  if (typeof modern === "string" && modern) return modern;
  if (modern && typeof modern === "object" && typeof modern.id === "string") return modern.id;
  return null;
}
