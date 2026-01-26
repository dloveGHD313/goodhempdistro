import { NextResponse } from "next/server";
import { getVendorPlanConfigs, type VendorPlanConfig } from "@/lib/pricing";
import { stripe } from "@/lib/stripe";

export async function GET() {
  const { plans, hasVendorPlans, missingEnv } = getVendorPlanConfigs();
  const imageCache = new Map<string, { imageUrl: string | null; imageAlt: string | null }>();

  const enrichedPlans: VendorPlanConfig[] = await Promise.all(
    plans.map(async (plan) => {
      if (imageCache.has(plan.priceId)) {
        const cached = imageCache.get(plan.priceId)!;
        return { ...plan, ...cached };
      }

      let imageUrl: string | null = null;
      let imageAlt: string | null = `${plan.displayName} plan image`;

      try {
        const price = await stripe.prices.retrieve(plan.priceId, {
          expand: ["product"],
        });
        const product = price.product as { images?: string[]; name?: string } | null;
        imageUrl = product?.images?.[0] ?? null;
        imageAlt = product?.name ? `${product.name} plan image` : imageAlt;

        if (!imageUrl && process.env.NODE_ENV !== "production") {
          console.warn("[pricing/vendor-plans] Stripe product missing images:", {
            priceId: plan.priceId,
          });
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[pricing/vendor-plans] Failed to load Stripe product image:", {
            priceId: plan.priceId,
            error,
          });
        }
      }

      const enriched = { ...plan, imageUrl, imageAlt };
      imageCache.set(plan.priceId, { imageUrl, imageAlt });
      return enriched;
    })
  );

  if (process.env.NODE_ENV !== "production" && missingEnv.length > 0) {
    console.warn("[pricing/vendor-plans] Missing env vars:", missingEnv);
  }

  return NextResponse.json({
    plans: enrichedPlans,
    hasVendorPlans: enrichedPlans.length > 0 && hasVendorPlans,
    ...(process.env.NODE_ENV !== "production" ? { missingEnv } : {}),
  });
}
