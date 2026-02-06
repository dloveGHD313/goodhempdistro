import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

/**
 * GET: Driver pay scale from active delivery_pricing (public, no auth).
 * Uses admin client so anon can read (RLS on delivery_pricing restricts to authenticated otherwise).
 */
export async function GET() {
  const admin = getSupabaseAdminClient();
  const { data: pricing, error } = await admin
    .from("delivery_pricing")
    .select("base_pay_driver, per_mile_driver, minimum_miles")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !pricing) {
    return NextResponse.json(
      { error: "Pay scale not configured" },
      { status: 404 }
    );
  }

  const basePayDriver = Number(pricing.base_pay_driver);
  const perMileDriver = Number(pricing.per_mile_driver);
  const minimumMiles = Number(pricing.minimum_miles);
  const minimumPayoutDriver = basePayDriver; // minimum payout = base when 0 billable miles

  return NextResponse.json({
    base_pay_driver: basePayDriver,
    per_mile_driver: perMileDriver,
    minimum_miles: minimumMiles,
    minimum_payout_driver: minimumPayoutDriver,
    formula_note: `Total payout = Base ($${basePayDriver.toFixed(2)}) + (Billable miles × $${perMileDriver.toFixed(2)}/mile), minimum $${minimumPayoutDriver.toFixed(2)}. Billable miles = max(0, distance − ${minimumMiles} free miles).`,
  });
}
