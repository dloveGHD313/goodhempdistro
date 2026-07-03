import { describe, expect, it, beforeAll } from "vitest";
import {
  getProductLimitStatus,
  getVendorEntitlements,
  getVendorPlanByPriceId,
  getVendorPriceEnvStatus,
  resolveVendorPriceId,
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

  it("getVendorPriceEnvStatus returns empty when all PRICE_ID env are valid", () => {
    const { missingEnv, invalidEnv } = getVendorPriceEnvStatus();
    expect(missingEnv).toEqual([]);
    expect(invalidEnv).toEqual([]);
  });

  it("resolveVendorPriceId returns price_ only and null for unknown plan", () => {
    const id = resolveVendorPriceId("vendor_starter_monthly", "monthly");
    expect(id).toBe("price_starter_month");
    expect(id?.startsWith("price_")).toBe(true);
    expect(resolveVendorPriceId("unknown_plan", "monthly")).toBeNull();
  });

  it("getVendorPriceEnvStatus reports invalidEnv when value is prod_", () => {
    const orig = process.env.STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID;
    process.env.STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID = "prod_xxx";
    const { invalidEnv } = getVendorPriceEnvStatus();
    expect(invalidEnv).toContain("STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID");
    process.env.STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID = orig;
  });

  it("resolveVendorPriceId returns null when env has prod_ for that plan", () => {
    const orig = process.env.STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID;
    process.env.STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID = "prod_xxx";
    expect(resolveVendorPriceId("vendor_starter_monthly", "monthly")).toBeNull();
    process.env.STRIPE_VENDOR_STARTER_MONTHLY_PRICE_ID = orig;
  });

  it("maps priceId to plan config", () => {
    const plan = getVendorPlanByPriceId("price_pro_year");
    expect(plan?.planKey).toBe("vendor_pro_annual");
    expect(plan?.productLimit).toBe(200);
  });

  it("returns entitlements for plan key", () => {
    const entitlements = getVendorEntitlements("vendor_enterprise_monthly");
    expect(entitlements?.productLimit).toBeNull();
    // P1-1 CEO decision (2026-07-03): Enterprise commission is 1%, not 0%.
    expect(entitlements?.commissionPercent).toBe(1);
  });

  it("detects product limit reached", () => {
    const status = getProductLimitStatus(10, 10);
    expect(status.reached).toBe(true);
    expect(status.limit).toBe(10);
  });
});
