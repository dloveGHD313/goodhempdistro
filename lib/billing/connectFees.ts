/**
 * Platform-fee computation for product checkout — reserve-transfer model.
 *
 * ── P0-1 HISTORY (2026-07-03) ─────────────────────────────────────────────
 * The original PR-B implementation used Stripe Connect DESTINATION CHARGES
 * (`transfer_data.destination` + `application_fee_amount`), which pays the
 * vendor their net IMMEDIATELY at charge time. But the checkout.session.
 * completed webhook ALSO queued the same vendor net into platform_reserve,
 * and the daily cron created a SECOND stripe.transfers.create for the same
 * amount 7 days later → vendor paid ~2× net on every Connect order.
 *
 * Per the 7-day-hold CEO directive (see lib/server/platformReserve.ts), the
 * reserve-then-transfer path is the intended payment mechanism. So checkout
 * no longer creates destination charges at all:
 *
 *   1. CHECKOUT — full charge settles on the PLATFORM account. We compute
 *      the platform fee from the vendor's tier and write it to session
 *      metadata (platform_fee_cents / platform_fee_tier / platform_fee_bps).
 *   2. WEBHOOK — checkout.session.completed reads the metadata and queues a
 *      platform_reserve row for vendor net = gross − fee, held 7 days.
 *   3. CRON — /api/cron/release-reserves transfers the net to the vendor's
 *      Connect account once the hold elapses. resolveDestinationAccount()
 *      skips vendors whose Connect account is missing/not-enabled and the
 *      next tick retries — so onboarding can complete AFTER the sale and
 *      the vendor still gets paid.
 *
 * Because payment happens at release time (not charge time), the fee
 * computation here deliberately does NOT check the vendor's Connect account
 * health — a vendor mid-onboarding still accrues reserves. Eligibility is
 * enforced exactly once, at transfer time, by the cron.
 */

import { COMMISSION_RATES } from "@/lib/referral";
import type { VendorTier } from "@/lib/billing/tier-mapping";

export type PlatformFeeParams = {
  /** Platform fee in cents — vendor net = gross − this. */
  applicationFeeAmount: number;
  /** Tier used for fee calculation (audit trail). */
  tier: VendorTier;
  /** Basis points used (audit trail). */
  feeBps: number;
};

export type PlatformFeeContext = {
  vendorId: string;
  /** Product (or order) subtotal that the fee is computed against. Cents. */
  productSubtotalCents: number;
};

type VendorRow = {
  tier: string | null;
};

const isValidTier = (t: string | null | undefined): t is VendorTier =>
  t === "starter" || t === "mid" || t === "top";

/**
 * Compute the platform fee for the given vendor + subtotal, from the
 * vendor's tier alone. Returns null when the fee can't be computed
 * (vendor row missing, tier invalid, bad subtotal) — checkout proceeds
 * without fee metadata and no reserve is queued (admin reconciles).
 *
 * @param admin - Supabase admin (service-role) client
 */
export async function getPlatformFeeForCheckout(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- avoids deep Supabase generic instantiation in callers
  admin: any,
  ctx: PlatformFeeContext
): Promise<PlatformFeeParams | null> {
  const { vendorId, productSubtotalCents } = ctx;

  if (!vendorId) {
    console.warn("[platform-fees] no vendorId — skipping fee metadata");
    return null;
  }

  if (!Number.isFinite(productSubtotalCents) || productSubtotalCents <= 0) {
    console.warn("[platform-fees] invalid subtotal — skipping fee metadata", {
      vendorId,
      productSubtotalCents,
    });
    return null;
  }

  const { data: vendor } = await admin
    .from("vendors")
    .select("tier")
    .eq("id", vendorId)
    .maybeSingle();

  const vendorRow = (vendor ?? null) as VendorRow | null;

  if (!vendorRow || !isValidTier(vendorRow.tier)) {
    console.warn("[platform-fees] vendor row missing or tier invalid — skipping fee metadata", {
      vendorId,
      tier: vendorRow?.tier ?? null,
    });
    return null;
  }

  const tier = vendorRow.tier;
  const feeBps = COMMISSION_RATES[tier];
  // Math.floor so we never overcharge the vendor — fee always rounds down.
  const applicationFeeAmount = Math.floor((productSubtotalCents * feeBps) / 10000);

  if (applicationFeeAmount < 0) {
    console.warn("[platform-fees] computed negative fee — skipping fee metadata", {
      vendorId,
      productSubtotalCents,
      feeBps,
    });
    return null;
  }

  return { applicationFeeAmount, tier, feeBps };
}
