import "server-only";

import { stripe } from "@/lib/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DeliveryRow = {
  id: string;
  driver_id: string | null;
  payout_cents: number | null;
  driver_payout_cents: number | null;
  payout_status: "unpaid" | "eligible" | "paid" | "failed" | string;
  confirmed_at: string | null;
  delivery_type: "retail" | "b2b" | string;
  proof_photo_url: string | null;
  receiver_name: string | null;
};

type DriverRow = {
  id: string;
  stripe_account_id: string | null;
};

function truncateMessage(message?: string): string | undefined {
  if (!message) return undefined;
  return message.length <= 300 ? message : `${message.slice(0, 300)}...`;
}

function normalizeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return 0;
}

export function computeDriverPayoutCents(deliveryRow: Pick<DeliveryRow, "driver_payout_cents" | "payout_cents">): number {
  const driverPayout = normalizeNumber(deliveryRow.driver_payout_cents);
  if (driverPayout > 0) return driverPayout;
  return normalizeNumber(deliveryRow.payout_cents);
}

export function isDeliveryProofVerifiable(
  deliveryType: string | null | undefined,
  proofPhotoUrl: string | null | undefined,
  receiverName: string | null | undefined
): boolean {
  const normalizedType = (deliveryType ?? "retail").trim().toLowerCase();
  const hasProof = Boolean(proofPhotoUrl?.trim());
  if (!hasProof) return false;

  if (normalizedType === "b2b") {
    return Boolean(receiverName?.trim());
  }

  return true;
}

export async function releaseDriverPayoutForDelivery(params: {
  deliveryId: string;
  userId?: string | null;
  requestId?: string;
  route?: string;
}): Promise<{
  ok: boolean;
  alreadyPaid?: boolean;
  stripeTransferId?: string;
  error?: string;
  requestId: string;
}> {
  const requestId = params.requestId ?? crypto.randomUUID();
  const route = params.route ?? "driver/payout/release";
  const admin = createSupabaseAdminClient();

  try {
    const { data: delivery, error: deliveryError } = await admin
      .from("deliveries")
      .select("id, driver_id, payout_cents, driver_payout_cents, payout_status, confirmed_at, delivery_type, proof_photo_url, receiver_name")
      .eq("id", params.deliveryId)
      .maybeSingle<DeliveryRow>();

    if (deliveryError || !delivery) {
      return { ok: false, error: "Delivery not found", requestId };
    }

    if (!delivery.driver_id) {
      return { ok: false, error: "Delivery has no assigned platform driver", requestId };
    }

    if (delivery.payout_status === "paid") {
      return { ok: true, alreadyPaid: true, requestId };
    }

    const { data: existingPayout } = await admin
      .from("driver_payouts")
      .select("id, status, stripe_transfer_id")
      .eq("delivery_id", delivery.id)
      .maybeSingle<{ id: string; status: string; stripe_transfer_id: string | null }>();

    if (existingPayout) {
      if (existingPayout.status === "sent") {
        return {
          ok: true,
          alreadyPaid: true,
          stripeTransferId: existingPayout.stripe_transfer_id ?? undefined,
          requestId,
        };
      }
      return { ok: false, error: "Payout record already exists", requestId };
    }

    const verifiable = isDeliveryProofVerifiable(
      delivery.delivery_type,
      delivery.proof_photo_url,
      delivery.receiver_name
    );
    if (!delivery.confirmed_at || !verifiable) {
      return { ok: false, error: "Delivery is not confirmed with verifiable proof", requestId };
    }

    const amountCents = computeDriverPayoutCents(delivery);
    if (amountCents <= 0) {
      return { ok: false, error: "Driver payout amount must be greater than zero", requestId };
    }

    const { data: driver } = await admin
      .from("drivers")
      .select("id, stripe_account_id")
      .eq("id", delivery.driver_id)
      .maybeSingle<DriverRow>();

    if (!driver?.stripe_account_id) {
      return { ok: false, error: "Driver Stripe account is missing", requestId };
    }

    const transfer = await stripe.transfers.create({
      amount: amountCents,
      currency: "usd",
      destination: driver.stripe_account_id,
      metadata: {
        delivery_id: delivery.id,
        driver_id: driver.id,
      },
    });

    const now = new Date().toISOString();

    await admin
      .from("deliveries")
      .update({
        driver_payout_cents: amountCents,
        payout_status: "paid",
        driver_stripe_transfer_id: transfer.id,
        payout_attempted_at: now,
        payout_error: null,
      })
      .eq("id", delivery.id);

    await admin.from("driver_payouts").insert({
      driver_id: driver.id,
      delivery_id: delivery.id,
      amount_cents: amountCents,
      stripe_transfer_id: transfer.id,
      status: "sent",
      error: null,
    });

    return { ok: true, stripeTransferId: transfer.id, requestId };
  } catch (error: unknown) {
    const err = error as { type?: string; code?: string; message?: string; requestId?: string };
    const safeMessage = truncateMessage(err?.message ?? (error instanceof Error ? error.message : String(error))) ?? "Payout failed";

    const admin = createSupabaseAdminClient();
    const { data: baseDelivery } = await admin
      .from("deliveries")
      .select("driver_id, payout_cents, driver_payout_cents")
      .eq("id", params.deliveryId)
      .maybeSingle<{ driver_id: string | null; payout_cents: number | null; driver_payout_cents: number | null }>();

    const amountCents = baseDelivery ? computeDriverPayoutCents(baseDelivery) : 0;
    const now = new Date().toISOString();

    await admin
      .from("deliveries")
      .update({
        payout_status: "failed",
        payout_attempted_at: now,
        payout_error: safeMessage,
      })
      .eq("id", params.deliveryId);

    if (baseDelivery?.driver_id && amountCents > 0) {
      try {
        await admin
          .from("driver_payouts")
          .insert({
            driver_id: baseDelivery.driver_id,
            delivery_id: params.deliveryId,
            amount_cents: amountCents,
            status: "failed",
            error: safeMessage,
          })
          .select("id")
          .maybeSingle();
      } catch {
        // no-op: idempotency unique violations are acceptable for failed payout logging
      }
    }

    console.error(
      "[driver/payout/release]",
      JSON.stringify({
        route,
        requestId,
        userId: params.userId ?? null,
        errorType: err?.type ?? null,
        errorCode: err?.code ?? null,
        message: safeMessage,
        stripeRequestId: err?.requestId ?? null,
      })
    );

    return { ok: false, error: "Driver payout transfer failed", requestId };
  }
}
