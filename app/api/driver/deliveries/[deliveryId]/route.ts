import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireApprovedDriver } from "@/lib/server/driverStatusGate";

const ROUTE_NAME = "driver/deliveries/detail";

function requestIdHeaders(requestId: string): Record<string, string> {
  return { "X-Request-Id": requestId, "Cache-Control": "no-store" };
}

function truncateMessage(message?: string): string | undefined {
  if (!message) return undefined;
  return message.length <= 300 ? message : `${message.slice(0, 300)}...`;
}

export async function GET(
  _req: NextRequest,
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

    const { data: delivery, error } = await supabase
      .from("deliveries")
      .select(
        "id, status, pickup_name, pickup_address, dropoff_name, dropoff_address, distance_miles, payout_cents, driver_payout_cents, payout_status, driver_stripe_transfer_id, delivery_type, delivered_at, confirmed_at, confirmed_by, proof_photo_url, receiver_name, bol_reference, payout_attempted_at, payout_error, created_at"
      )
      .eq("id", deliveryId)
      .eq("driver_id", driverCheck.driverId)
      .maybeSingle();

    if (error || !delivery) {
      return NextResponse.json(
        { ok: false, error: "Delivery not found", requestId },
        { status: 404, headers: requestIdHeaders(requestId) }
      );
    }

    return NextResponse.json({ ok: true, requestId, delivery }, { headers: requestIdHeaders(requestId) });
  } catch (error: unknown) {
    const err = error as { type?: string; code?: string; message?: string; requestId?: string };
    console.error(
      "[driver/deliveries/detail]",
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
