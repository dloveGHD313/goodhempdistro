import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";

/**
 * Get user's deliveries (vendor or driver based on role)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if vendor
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    // Check if driver
    const { data: driver } = await supabase
      .from("drivers")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    let deliveries: any[] = [];

    if (vendor) {
      // Get vendor deliveries
      const { data: vendorDeliveries } = await supabase
        .from("deliveries")
        .select("*")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });

      deliveries = vendorDeliveries || [];
    } else if (driver) {
      // Get driver deliveries
      const { data: driverDeliveries } = await supabase
        .from("deliveries")
        .select("*")
        .eq("driver_id", driver.id)
        .order("created_at", { ascending: false });

      deliveries = driverDeliveries || [];
    }

    return NextResponse.json({ deliveries });
  } catch (error) {
    console.error("Get deliveries error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
