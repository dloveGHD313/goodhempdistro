/**
 * Stripe Connect destination-charge computation for product checkout.
 *
 * When a vendor has an active Stripe Connect account (charges_enabled=true,
 * payouts_enabled=true), checkout uses a destination charge:
 *
 *   payment_intent_data: {
 *     application_fee_amount: <platform_fee_cents>,
 *     transfer_data: { destination: <stripe_account_id> },
 *     on_behalf_of: <stripe_account_id>,
 *   }
 *
 * Platform fee is computed from vendor.tier via lib/billing/tier-mapping.ts
 * + lib/referral.ts COMMISSION_RATES. The fee applies to the PRODUCT subtotal
 * only — delivery fees go entirely to the platform (or driver), not to the
 * vendor, so they're excluded from the application_fee base.
 *
 * Failure modes (all return null → checkout falls back to platform-collection
 * behavior, vendor gets no transfer this round; admin reconciles manually):
 *
 *   - vendor has no Connect account yet
 *   - Connect account exists but charges_enabled / payouts_enabled is false
 *     (KYC incomplete, restricted, disabled)
 *   - vendor row missing or tier null
 *
 * In every failure case we log a structured warn so production logs surface
 * unconnected vendors that started getting orders. Future PR-D's cron should
 * also flag these.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { COMMISSION_RATES } from "@/lib/referral";
import type { VendorTier } from "@/lib/billing/tier-mapping";

export type ConnectFeeParams = {
  /** Stripe Connect destination account ID (acct_...). */
  destination: string;
  /** Platform fee in cents — subtract this from gross to know vendor net. */
  applicationFeeAmount: number;
  /** Tier used for fee calculation (audit trail). */
  tier: VendorTier;
  /** Basis points used (audit trail). */
  feeBps: number;
};

export type ConnectFeeContext = {
  vendorId: string;
  vendorOwnerUserId: string;
  /** Product (or order) subtotal that the fee is computed against. Cents. */
  productSubtotalCents: number;
};

type ConnectAccountRow = {
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
};

type VendorRow = {
  tier: string | null;
};

const isValidTier = (t: string | null | undefined): t is VendorTier =>
  t === "starter" || t === "mid" || t === "top";

/**
 * Compute Connect destination charge params for the given vendor + subtotal.
 * Returns null when no destination charge should be applied (vendor not
 * connected / Connect account not enabled / vendor row missing).
 *
 * @param admin - Supabase admin (service-role) client
 * @param ctx - vendor + subtotal context
 */
export async function getConnectFeeForCheckout(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- avoids deep Supabase generic instantiation in callers
  admin: any,
  ctx: ConnectFeeContext
): Promise<ConnectFeeParams | null> {
  const { vendorId, vendorOwnerUserId, productSubtotalCents } = ctx;

  if (!vendorOwnerUserId) {
    console.warn("[connect-fees] no vendor owner_user_id — skipping destination charge", { vendorId });
    return null;
  }

  if (!Number.isFinite(productSubtotalCents) || productSubtotalCents <= 0) {
    console.warn("[connect-fees] invalid subtotal — skipping destination charge", {
      vendorId,
      productSubtotalCents,
    });
    return null;
  }

  // Fetch Connect account + vendor in parallel — both are point lookups
  const [connectResult, vendorResult] = await Promise.all([
    admin
      .from("vendor_connect_accounts")
      .select("stripe_account_id, charges_enabled, payouts_enabled")
      .eq("user_id", vendorOwnerUserId)
      .maybeSingle(),
    admin.from("vendors").select("tier").eq("id", vendorId).maybeSingle(),
  ]);

  const connect = (connectResult.data ?? null) as ConnectAccountRow | null;
  const vendor = (vendorResult.data ?? null) as VendorRow | null;

  if (!connect) {
    console.warn("[connect-fees] vendor has no Connect account — skipping destination charge", {
      vendorId,
      vendorOwnerUserId,
    });
    return null;
  }

  if (!connect.charges_enabled || !connect.payouts_enabled) {
    console.warn("[connect-fees] Connect account not fully enabled — skipping destination charge", {
      vendorId,
      stripe_account_id: connect.stripe_account_id,
      charges_enabled: connect.charges_enabled,
      payouts_enabled: connect.payouts_enabled,
    });
    return null;
  }

  if (!vendor || !isValidTier(vendor.tier)) {
    console.warn("[connect-fees] vendor row missing or tier invalid — skipping destination charge", {
      vendorId,
      tier: vendor?.tier ?? null,
    });
    return null;
  }

  const tier = vendor.tier;
  const feeBps = COMMISSION_RATES[tier];
  // Use Math.floor so we never overcharge the vendor — fee is always
  // rounded down to the nearest cent.
  const applicationFeeAmount = Math.floor((productSubtotalCents * feeBps) / 10000);

  if (applicationFeeAmount < 0) {
    console.warn("[connect-fees] computed negative application_fee_amount — skipping destination charge", {
      vendorId,
      productSubtotalCents,
      feeBps,
    });
    return null;
  }

  return {
    destination: connect.stripe_account_id,
    applicationFeeAmount,
    tier,
    feeBps,
  };
}

/**
 * Build the Stripe `payment_intent_data` block for a Checkout Session when
 * the vendor has an active Connect account. Returns `undefined` when no
 * destination charge should be applied — callers should spread the result
 * conditionally:
 *
 *   const piData = buildPaymentIntentData(connectFee);
 *   stripe.checkout.sessions.create({
 *     ...,
 *     ...(piData ? { payment_intent_data: piData } : {}),
 *   });
 */
export function buildPaymentIntentData(
  connectFee: ConnectFeeParams | null,
): Record<string, unknown> | undefined {
  if (!connectFee) return undefined;
  return {
    application_fee_amount: connectFee.applicationFeeAmount,
    transfer_data: { destination: connectFee.destination },
    on_behalf_of: connectFee.destination,
  };
}
