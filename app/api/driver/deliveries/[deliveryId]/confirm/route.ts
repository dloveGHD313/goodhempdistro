import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireApprovedDriver } from "@/lib/server/driverStatusGate";
import {
  computeDriverPayoutCents,
  isDeliveryProofVerifiable,
  releaseDriverPayoutForDelivery,
} from "@/lib/server/driverPayoutService";

const ROUTE_NAME = "driver/deliveries/confirm";

type DeliveryRecord = {
  id: string;
  driver_id: string | null;
  delivery_type: "retail" | "b2b" | null;
  payout_cents: number;
  driver_payout_cents: number;
  payout_status: "unpaid" | "eligible" | "paid" | "failed";
  delivered_at: string | null;
  confirmed_at: string | null;
  proof_photo_url: string | null;
  receiver_name: string | null;
};

function requestIdHeaders(requestId: string): Record<string, string> {
  return { "X-Request-Id": requestId, "Cache-Control": "no-store" };
}

function truncateMessage(message?: string): string | undefined {
  if (!message) return undefined;
  return message.length <= 300 ? message : `${message.slice(0, 300)}...`;
}

function normalizeDeliveryType(input: unknown): "retail" | "b2b" {
  const value = typeof input === "string" ? input.toLowerCase().trim() : "";
  return value === "b2b" ? "b2b" : "retail";
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ deliveryId: string }> }
) {
  const requestId = crypto.randomUUID();
  let safeUserId: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized", requestId },
        { status: 401, headers: requestIdHeaders(requestId) }
      );
    }
    safeUserId = user.id;

    const driverCheck = await requireApprovedDriver(user.id);
    if (!driverCheck.allowed) {
      return NextResponse.json(
        { ok: false, ...driverCheck.json, requestId },
        { status: driverCheck.status, headers: requestIdHeaders(requestId) }
      );
    }

    const { deliveryId } = await context.params;

    const { data: delivery, error: deliveryError } = await supabase
      .from("deliveries")
      .select(
        "id, driver_id, delivery_type, payout_cents, driver_payout_cents, payout_status, delivered_at, confirmed_at, proof_photo_url, receiver_name"
      )
      .eq("id", deliveryId)
      .eq("driver_id", driverCheck.driverId)
      .maybeSingle<DeliveryRecord>();

    if (deliveryError || !delivery) {
      return NextResponse.json(
        { ok: false, error: "Delivery not found", requestId },
        { status: 404, headers: requestIdHeaders(requestId) }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      delivery_type?: "retail" | "b2b";
      proof_photo_url?: string;
      receiver_name?: string;
      bol_reference?: string;
    } | null;

    const deliveryType = normalizeDeliveryType(body?.delivery_type ?? delivery.delivery_type ?? "retail");
    const proofPhotoUrl = body?.proof_photo_url?.trim() ?? "";
    const receiverName = body?.receiver_name?.trim() ?? "";
    const bolReference = body?.bol_reference?.trim() ?? "";

    const verifiable = isDeliveryProofVerifiable(deliveryType, proofPhotoUrl, receiverName);
    const now = new Date().toISOString();
    const driverPayoutCents =
      (delivery.driver_payout_cents ?? 0) > 0
        ? delivery.driver_payout_cents
        : computeDriverPayoutCents(delivery);

    const updatePayload: {
      delivery_type: "retail" | "b2b";
      proof_photo_url: string;
      receiver_name: string | null;
      bol_reference: string | null;
      delivered_at: string;
      driver_payout_cents: number;
      confirmed_at?: string;
      confirmed_by?: "driver";
      payout_status: "unpaid" | "eligible";
    } = {
      delivery_type: deliveryType,
      proof_photo_url: proofPhotoUrl,
      receiver_name: receiverName || null,
      bol_reference: bolReference || null,
      delivered_at: delivery.delivered_at ?? now,
      driver_payout_cents: driverPayoutCents,
      payout_status: verifiable ? "eligible" : "unpaid",
    };

    if (verifiable) {
      updatePayload.confirmed_at = delivery.confirmed_at ?? now;
      updatePayload.confirmed_by = "driver";
    }

    const { data: updated, error: updateError } = await supabase
      .from("deliveries")
      .update(updatePayload)
      .eq("id", delivery.id)
      .eq("driver_id", driverCheck.driverId)
      .select("id, payout_status")
      .maybeSingle<{ id: string; payout_status: "unpaid" | "eligible" | "paid" | "failed" }>();

    if (updateError || !updated) {
      return NextResponse.json(
        { ok: false, error: "Failed to update delivery", requestId },
        { status: 500, headers: requestIdHeaders(requestId) }
      );
    }

    let payoutAttempted = false;
    let stripeTransferId: string | undefined;
    let payoutStatus = updated.payout_status;

    if (verifiable && updated.payout_status === "eligible") {
      payoutAttempted = true;
      const payoutResult = await releaseDriverPayoutForDelivery({
        deliveryId: updated.id,
        userId: user.id,
        requestId,
        route: ROUTE_NAME,
      });

      if (payoutResult.ok && payoutResult.stripeTransferId) {
        stripeTransferId = payoutResult.stripeTransferId;
        payoutStatus = "paid";
      } else if (!payoutResult.ok) {
        payoutStatus = "failed";
      }
    }

    return NextResponse.json(
      {
        ok: true,
        requestId,
        confirmed: verifiable,
        payout_status: payoutStatus,
        payout_attempted: payoutAttempted,
        stripe_transfer_id: stripeTransferId,
      },
      { headers: requestIdHeaders(requestId) }
    );
  } catch (error: unknown) {
    const err = error as { type?: string; code?: string; message?: string; requestId?: string };
    console.error(
      "[driver/deliveries/confirm]",
      JSON.stringify({
        route: ROUTE_NAME,
        requestId,
        userId: safeUserId,
        errorType: err?.type ?? null,
        errorCode: err?.code ?? null,
        message: truncateMessage(err?.message ?? (error instanceof Error ? error.message : String(error))) ?? null,
        stripeRequestId: err?.requestId ?? null,
      })
    );

    return NextResponse.json(
      { ok: false, error: "Internal server error", requestId },
      { status: 500, headers: requestIdHeaders(requestId) }
    );
  }
}
