import { NextResponse } from "next/server";
import { getVendorPlanConfigs } from "@/lib/pricing";

export async function GET() {
  const { plans, hasVendorPlans, missingEnv } = getVendorPlanConfigs();

  if (process.env.NODE_ENV !== "production" && missingEnv.length > 0) {
    console.warn("[pricing/vendor-plans] Missing env vars:", missingEnv);
  }

  return NextResponse.json({
    plans,
    hasVendorPlans,
    ...(process.env.NODE_ENV !== "production" ? { missingEnv } : {}),
  });
}
