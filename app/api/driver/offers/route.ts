import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { requireApprovedDriver } from "@/lib/server/driverStatusGate";

function requestIdHeaders(requestId: string) {
  return { "X-Request-Id": requestId, "Cache-Control": "no-store" };
}

export async function GET() {
  const requestId = crypto.randomUUID();

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized", requestId }, { status: 401, headers: requestIdHeaders(requestId) });
    }

    const gate = await requireApprovedDriver(user.id);
    if (!gate.allowed) {
      return NextResponse.json({ ok: false, ...gate.json, requestId }, { status: gate.status, headers: requestIdHeaders(requestId) });
    }

    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from("delivery_offers")
      .select(
        "id, delivery_id, status, offered_at, expires_at, offer_rank, deliveries:delivery_id(id, pickup_name, pickup_address, dropoff_name, dropoff_address, payout_cents, status)"
      )
      .eq("driver_id", gate.driverId)
      .eq("status", "offered")
      .gt("expires_at", nowIso)
      .order("offered_at", { ascending: false });

    if (error) {
      return NextResponse.json({ ok: false, error: "Failed to load offers", requestId }, { status: 500, headers: requestIdHeaders(requestId) });
    }

    return NextResponse.json({ ok: true, requestId, offers: data ?? [] }, { headers: requestIdHeaders(requestId) });
  } catch {
    return NextResponse.json({ ok: false, error: "Internal server error", requestId }, { status: 500, headers: requestIdHeaders(requestId) });
  }
}
