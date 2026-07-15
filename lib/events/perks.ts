/**
 * Event ticket perks (perks spec 2026-07-10 §7) — pure helpers + grant
 * tracking. Tier numbers come from the entitlements SSOT:
 * discount 0/5/10/20%, early on-sale window 0/0/24/48h, free
 * community-event ticket 0/0/0/1 per quarter (Premium).
 */

import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { TIER_ENTITLEMENTS, type ConsumerTier } from "@/lib/entitlements";

/** Tier discount on the ticket subtotal. Floor — never round up. */
export function eventTicketDiscountCents(
  ticketSubtotalCents: number,
  tier: ConsumerTier
): number {
  if (ticketSubtotalCents <= 0) return 0;
  const pct = TIER_ENTITLEMENTS[tier].eventTicketDiscountPct;
  return Math.floor((ticketSubtotalCents * pct) / 100);
}

/**
 * Whether ticket sales are open for this tier. tickets_on_sale_at null
 * means on sale immediately (no early-access distinction). Paid tiers
 * unlock eventEarlyAccessHours before the public time.
 */
export function isTicketSalesOpenForTier(
  ticketsOnSaleAt: string | null,
  tier: ConsumerTier,
  now: Date = new Date()
): { open: boolean; opensAt: Date | null } {
  if (!ticketsOnSaleAt) return { open: true, opensAt: null };
  const opensAt = new Date(
    new Date(ticketsOnSaleAt).getTime() -
      TIER_ENTITLEMENTS[tier].eventEarlyAccessHours * 60 * 60 * 1000
  );
  return { open: now.getTime() >= opensAt.getTime(), opensAt };
}

/** Quarter key for grant tracking, e.g. "2026-Q3" (UTC). */
export function quarterKey(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

/**
 * Remaining free event tickets this quarter for a user. Redemptions are
 * recorded as consumer_loyalty_events (event_type=free_event_ticket) with
 * metadata.quarter — the spec's suggested tracking table.
 */
export async function freeEventTicketsRemaining(
  userId: string,
  tier: ConsumerTier,
  now: Date = new Date()
): Promise<number> {
  const allowance = TIER_ENTITLEMENTS[tier].freeEventTicketsPerQuarter;
  if (allowance <= 0) return 0;
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("consumer_loyalty_events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_type", "free_event_ticket")
    .filter("metadata->>quarter", "eq", quarterKey(now));
  if (error) {
    console.error("[event-perks] redemption query failed:", error.message);
    return 0; // fail closed — never over-grant
  }
  return Math.max(0, allowance - (data?.length ?? 0));
}

/** Record a free-ticket redemption (called from the paid webhook). */
export async function recordFreeEventTicketRedemption(params: {
  userId: string;
  eventOrderId: string;
  eventId: string;
  amountCents: number;
  now?: Date;
}): Promise<void> {
  const admin = getSupabaseAdminClient();
  const quarter = quarterKey(params.now ?? new Date());
  // Dedupe per order for webhook replays.
  const { data: existing } = await admin
    .from("consumer_loyalty_events")
    .select("id")
    .eq("user_id", params.userId)
    .eq("event_type", "free_event_ticket")
    .filter("metadata->>event_order_id", "eq", params.eventOrderId)
    .maybeSingle();
  if (existing?.id) return;
  const { error } = await admin.rpc("consumer_loyalty_add_points", {
    p_user_id: params.userId,
    p_points: 0,
    p_event_type: "free_event_ticket",
    p_metadata: {
      quarter,
      event_order_id: params.eventOrderId,
      event_id: params.eventId,
      amount_cents: params.amountCents,
    },
  });
  if (error) {
    console.error("[event-perks] redemption record failed:", error.message);
  }
}
