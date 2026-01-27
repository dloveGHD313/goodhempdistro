import { NextResponse } from "next/server";
import { getConsumerPlanConfigs } from "@/lib/consumer-plans";

export async function GET() {
  const { plans, hasConsumerPlans, missingEnv } = getConsumerPlanConfigs();

  if (missingEnv.length > 0) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[pricing/consumer-plans] Missing env vars:", missingEnv);
    }
    return NextResponse.json(
      {
        error: "Missing Stripe consumer price IDs.",
        missingEnv,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    plans,
    hasConsumerPlans,
  });
}
