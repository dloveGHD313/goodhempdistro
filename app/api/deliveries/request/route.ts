import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

/**
 * Create delivery request (vendor only)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify vendor
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("owner_user_id", user.id)
      .single();

    if (!vendor) {
      return NextResponse.json(
        { error: "Vendor account required" },
        { status: 403 }
      );
    }

    const { pickup_name, pickup_address, dropoff_name, dropoff_address, distance_miles } = await req.json();

    if (!pickup_name || !pickup_address || !dropoff_name || !dropoff_address) {
      return NextResponse.json(
        { error: "All delivery fields are required" },
        { status: 400 }
      );
    }

    // Calculate payout (MVP: $1.50 per mile minimum, $5 base)
    const miles = parseFloat(distance_miles) || 0;
    const payoutCents = Math.max(500, Math.round(miles * 150)); // $5 minimum, $1.50/mile

    // Create delivery
    const { data: delivery, error } = await supabase
      .from("deliveries")
      .insert({
        vendor_id: vendor.id,
        pickup_name: pickup_name.trim(),
        pickup_address: pickup_address.trim(),
        dropoff_name: dropoff_name.trim(),
        dropoff_address: dropoff_address.trim(),
        distance_miles: miles > 0 ? miles : null,
        payout_cents: payoutCents,
        status: "pending",
      })
      .select("id, status, payout_cents")
      .single();

    if (error) {
      console.error("Error creating delivery:", error);
      return NextResponse.json(
        { error: "Failed to create delivery request" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      delivery: delivery,
    }, { status: 201 });
  } catch (error) {
    console.error("Delivery request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
