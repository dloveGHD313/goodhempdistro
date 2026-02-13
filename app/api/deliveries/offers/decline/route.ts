import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashOfferToken } from "@/lib/server/dispatchService";

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const admin = createSupabaseAdminClient();

  const deliveryId = req.nextUrl.searchParams.get("deliveryId");
  const driverId = req.nextUrl.searchParams.get("driverId");
  const token = req.nextUrl.searchParams.get("token");

  if (!deliveryId || !driverId || !token) {
    return NextResponse.json({ ok: false, error: "Missing parameters", requestId }, { status: 400 });
  }

  const tokenHash = hashOfferToken(token);

  const { data: driver } = await admin
    .from("drivers")
    .select("id, status")
    .eq("id", driverId)
    .maybeSingle<{ id: string; status: string }>();

  if (!driver || driver.status !== "approved") {
    return NextResponse.json({ ok: false, error: "Driver not eligible", requestId }, { status: 403 });
  }

  const { data: offer } = await admin
    .from("delivery_offers")
    .select("id, status, accept_token_hash")
    .eq("delivery_id", deliveryId)
    .eq("driver_id", driverId)
    .maybeSingle<{ id: string; status: string; accept_token_hash: string }>();

  if (!offer || offer.accept_token_hash !== tokenHash) {
    return NextResponse.json({ ok: false, error: "Invalid offer token", requestId }, { status: 403 });
  }

  await admin
    .from("delivery_offers")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", offer.id)
    .eq("status", "offered");

  return NextResponse.redirect(new URL("/driver/dashboard?offer=declined", req.url));
}
