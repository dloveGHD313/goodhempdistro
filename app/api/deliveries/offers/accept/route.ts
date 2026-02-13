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
    .select("id, delivery_id, driver_id, status, expires_at, accept_token_hash")
    .eq("delivery_id", deliveryId)
    .eq("driver_id", driverId)
    .maybeSingle<{ id: string; delivery_id: string; driver_id: string; status: string; expires_at: string; accept_token_hash: string }>();

  if (!offer || offer.accept_token_hash !== tokenHash) {
    return NextResponse.json({ ok: false, error: "Invalid offer token", requestId }, { status: 403 });
  }

  if (offer.status !== "offered" || new Date(offer.expires_at).getTime() <= Date.now()) {
    await admin.from("delivery_offers").update({ status: "expired", responded_at: new Date().toISOString() }).eq("id", offer.id).eq("status", "offered");
    return NextResponse.redirect(new URL("/driver/dashboard?offer=expired", req.url));
  }

  const { data: delivery } = await admin
    .from("deliveries")
    .select("id, driver_id, status")
    .eq("id", deliveryId)
    .maybeSingle<{ id: string; driver_id: string | null; status: string }>();

  if (!delivery || delivery.driver_id) {
    await admin.from("delivery_offers").update({ status: "expired", responded_at: new Date().toISOString() }).eq("id", offer.id).eq("status", "offered");
    return NextResponse.redirect(new URL("/driver/dashboard?offer=taken", req.url));
  }

  const now = new Date().toISOString();

  await admin.from("delivery_offers").update({ status: "accepted", responded_at: now }).eq("id", offer.id).eq("status", "offered");

  const { data: assigned } = await admin
    .from("deliveries")
    .update({
      driver_id: driverId,
      status: "assigned",
      assigned_at: now,
      pickup_due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    .eq("id", deliveryId)
    .is("driver_id", null)
    .in("status", ["pending", "offering"])
    .select("id")
    .maybeSingle();

  if (!assigned) {
    await admin.from("delivery_offers").update({ status: "expired", responded_at: now }).eq("id", offer.id);
    return NextResponse.redirect(new URL("/driver/dashboard?offer=taken", req.url));
  }

  await admin
    .from("delivery_offers")
    .update({ status: "cancelled", responded_at: now })
    .eq("delivery_id", deliveryId)
    .neq("id", offer.id)
    .eq("status", "offered");

  return NextResponse.redirect(new URL("/driver/dashboard?offer=accepted", req.url));
}
