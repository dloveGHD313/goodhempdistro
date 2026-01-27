import { describe, expect, it, beforeAll } from "vitest";
import { getConsumerPlanByKey, getConsumerPlanByPriceId } from "@/lib/consumer-plans";

describe("consumer plans config", () => {
  beforeAll(() => {
    process.env.STRIPE_CONSUMER_STARTER_MONTHLY_PRICE_ID = "price_consumer_starter_month";
    process.env.STRIPE_CONSUMER_STARTER_ANNUAL_PRICE_ID = "price_consumer_starter_year";
    process.env.STRIPE_CONSUMER_PLUS_MONTHLY_PRICE_ID = "price_consumer_plus_month";
    process.env.STRIPE_CONSUMER_PLUS_ANNUAL_PRICE_ID = "price_consumer_plus_year";
    process.env.STRIPE_CONSUMER_VIP_MONTHLY_PRICE_ID = "price_consumer_vip_month";
    process.env.STRIPE_CONSUMER_VIP_ANNUAL_PRICE_ID = "price_consumer_vip_year";
  });

  it("returns plan by key", () => {
    const plan = getConsumerPlanByKey("consumer_plus_monthly");
    expect(plan?.tier).toBe("Plus");
    expect(plan?.billingInterval).toBe("month");
    expect(plan?.loyaltyMultiplier).toBe(1.5);
    expect(plan?.imageUrl.startsWith("/images/consumer-plans/")).toBe(true);
    expect(plan?.imageAlt.length).toBeGreaterThan(0);
  });

  it("maps priceId to plan", () => {
    const plan = getConsumerPlanByPriceId("price_consumer_vip_year");
    expect(plan?.planKey).toBe("consumer_vip_annual");
  });
});
