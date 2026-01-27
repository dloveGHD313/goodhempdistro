import { NextResponse } from "next/server";
import { getConsumerPlanConfigs } from "@/lib/consumer-plans";
import { stripe } from "@/lib/stripe";

const formatPrice = (amount: number | null, interval: "month" | "year") => {
  if (amount === null) {
    return interval === "year" ? "$0/year" : "$0/month";
  }
  const dollars = (amount / 100).toFixed(2);
  return interval === "year" ? `$${dollars}/year` : `$${dollars}/month`;
};

export async function GET() {
  const { plans, hasConsumerPlans, missingEnv } = getConsumerPlanConfigs();
  const priceCache = new Map<string, { headlinePriceText: string; interval: "month" | "year" }>();

  const enrichedPlans = await Promise.all(
    plans.map(async (plan) => {
      if (priceCache.has(plan.priceId)) {
        const cached = priceCache.get(plan.priceId)!;
        return { ...plan, headlinePriceText: cached.headlinePriceText, interval: cached.interval };
      }

      let headlinePriceText = "";
      let interval: "month" | "year" = plan.billingCycle === "annual" ? "year" : "month";

      try {
        const price = await stripe.prices.retrieve(plan.priceId);
        const recurring = price.recurring?.interval;
        interval = recurring === "year" ? "year" : "month";
        headlinePriceText = formatPrice(price.unit_amount, interval);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[pricing/consumer-plans] Failed to load Stripe price:", {
            priceId: plan.priceId,
            error,
          });
        }
        headlinePriceText = formatPrice(null, interval);
      }

      const enriched = { ...plan, headlinePriceText, interval };
      priceCache.set(plan.priceId, { headlinePriceText, interval });
      return enriched;
    })
  );

  if (process.env.NODE_ENV !== "production" && missingEnv.length > 0) {
    console.warn("[pricing/consumer-plans] Missing env vars:", missingEnv);
  }

  return NextResponse.json({
    plans: enrichedPlans,
    hasConsumerPlans,
    ...(process.env.NODE_ENV !== "production" ? { missingEnv } : {}),
  });
}
