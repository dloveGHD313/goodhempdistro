import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

const CACHE_NO_STORE = { "Cache-Control": "no-store" as const };

/**
 * GET: Driver pay scale from active delivery_pricing (public, no auth).
 * Uses SERVICE ROLE admin client to bypass RLS so unauthenticated visitors can read.
 */
export async function GET() {
  try {
    const admin = getSupabaseAdminClient();
    const { data: pricing, error } = await admin
      .from("delivery_pricing")
      .select("base_pay_driver, per_mile_driver, minimum_miles")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[logistics/pay-scale] query error", error.message);
      return NextResponse.json(
        { error: "Unable to load pay scale", code: "PAY_SCALE_ERROR" },
        { status: 500, headers: CACHE_NO_STORE }
      );
    }

    if (!pricing) {
      return NextResponse.json(
        { error: "Pay scale not configured", code: "PAY_SCALE_NOT_CONFIGURED" },
        { status: 404, headers: CACHE_NO_STORE }
      );
    }

    const basePayDriver = Number(pricing.base_pay_driver);
    const perMileDriver = Number(pricing.per_mile_driver);
    const minimumMiles = Number(pricing.minimum_miles);
    const minimumPayoutDriver = basePayDriver;

    return NextResponse.json(
      {
        base_pay_driver: basePayDriver,
        per_mile_driver: perMileDriver,
        minimum_miles: minimumMiles,
        minimum_payout_driver: minimumPayoutDriver,
        formula_note: `Total payout = Base ($${basePayDriver.toFixed(2)}) + (Billable miles × $${perMileDriver.toFixed(2)}/mile), minimum $${minimumPayoutDriver.toFixed(2)}. Billable miles = max(0, distance − ${minimumMiles} free miles).`,
      },
      { headers: CACHE_NO_STORE }
    );
  } catch (e) {
    console.warn("[logistics/pay-scale] unexpected error", e);
    return NextResponse.json(
      { error: "Unable to load pay scale", code: "PAY_SCALE_ERROR" },
      { status: 500, headers: CACHE_NO_STORE }
    );
  }
}
