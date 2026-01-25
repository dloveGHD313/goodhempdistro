import { NextRequest, NextResponse } from "next/server";
import { getCheckoutSession } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const session = await getCheckoutSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Invalid session" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const orderId = session.metadata?.order_id || null;
    const eventId = session.metadata?.event_id || null;

    const admin = getSupabaseAdminClient();
    const { data: order } = orderId
      ? await admin
          .from("event_orders")
          .select("id, event_id, status, total_cents")
          .eq("id", orderId)
          .maybeSingle()
      : { data: null };

    return NextResponse.json(
      {
        sessionId,
        orderId: order?.id || orderId,
        eventId: order?.event_id || eventId,
        status: order?.status || "pending",
        totalCents: order?.total_cents ?? session.amount_total ?? 0,
        currency: session.currency || "usd",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[events/confirm] Error confirming event order", error);
    return NextResponse.json(
      { error: "Failed to confirm event order" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
