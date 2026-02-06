import { NextResponse } from "next/server";
import { getActiveDeliveryPricing } from "@/lib/server/deliveryPricing";

/**
 * GET: Driver pay scale from active delivery_pricing (single source of truth).
 * Used by /logistics to display payout formula. Does not expose customer fees or margin.
 */
export async function GET() {
  const pricing = await getActiveDeliveryPricing();
  if (!pricing) {
    return NextResponse.json(
      { error: "Pay scale not configured" },
      { status: 404 }
    );
  }

  const basePayDriver = Number(pricing.base_pay_driver);
  const perMileDriver = Number(pricing.per_mile_driver);
  const minimumMiles = Number(pricing.minimum_miles);

  return NextResponse.json({
    base_pay_driver: basePayDriver,
    per_mile_driver: perMileDriver,
    minimum_miles: minimumMiles,
    formula_note: `Total payout = Base ($${basePayDriver.toFixed(2)}) + (Billable miles × $${perMileDriver.toFixed(2)}/mile), minimum $${basePayDriver.toFixed(2)}. Billable miles = max(0, distance − ${minimumMiles} free miles).`,
  });
}
