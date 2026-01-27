import { describe, expect, it, beforeAll } from "vitest";
import {
  getProductLimitStatus,
  getVendorEntitlements,
  getVendorPlanByPriceId,
} from "@/lib/pricing";

describe("vendor entitlements", () => {
  beforeAll(() => {
    process.env.STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID = "price_starter_month";
    process.env.STRIPE_VENDOR_STARTER_ANNUAL_PRICE_ID = "price_starter_year";
    process.env.STRIPE_VENDOR_PRO_MONTHLY_PRICE_ID = "price_pro_month";
    process.env.STRIPE_VENDOR_PRO_ANNUAL_PRICE_ID = "price_pro_year";
    process.env.STRIPE_VENDOR_ENTERPRISE_MONTHLY_PRICE_ID = "price_ent_month";
    process.env.STRIPE_VENDOR_ENTERPRISE_ANNUAL_PRICE_ID = "price_ent_year";
  });

  it("maps priceId to plan config", () => {
    const plan = getVendorPlanByPriceId("price_pro_year");
    expect(plan?.planKey).toBe("vendor_pro_annual");
    expect(plan?.productLimit).toBe(200);
  });

  it("returns entitlements for plan key", () => {
    const entitlements = getVendorEntitlements("vendor_enterprise_monthly");
    expect(entitlements?.productLimit).toBeNull();
    expect(entitlements?.commissionPercent).toBe(0);
  });

  it("detects product limit reached", () => {
    const status = getProductLimitStatus(10, 10);
    expect(status.reached).toBe(true);
    expect(status.limit).toBe(10);
  });
});
