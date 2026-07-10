import { describe, expect, it } from "vitest";
import {
  computeDiscountCents,
  selectApplicableCoupons,
  generateCouponCode,
  type CouponRow,
} from "@/lib/coupons";

const VENDOR_A = "11111111-1111-1111-1111-111111111111";
const VENDOR_B = "22222222-2222-2222-2222-222222222222";

function coupon(overrides: Partial<CouponRow>): CouponRow {
  return {
    id: overrides.code ?? "id",
    code: "GHD-TEST",
    percent_off: 10,
    source: "platform",
    vendor_id: null,
    status: "active",
    expires_at: null,
    ...overrides,
  };
}

describe("selectApplicableCoupons — CEO stacking decision 2026-07-10", () => {
  const platform10 = coupon({ code: "P10", percent_off: 10 });
  const platform15 = coupon({ code: "P15", percent_off: 15 });
  const vendorA20 = coupon({ code: "V20", percent_off: 20, source: "vendor", vendor_id: VENDOR_A });

  it("Plus/Premium stack exactly one platform + one vendor coupon", () => {
    const result = selectApplicableCoupons({
      tier: "Plus",
      coupons: [platform10, vendorA20],
      orderVendorId: VENDOR_A,
    });
    expect(result.applied.map((c) => c.code).sort()).toEqual(["P10", "V20"]);
    expect(result.rejected).toEqual([]);
  });

  it("Free/Basic get one coupon max — the best one wins, the other is rejected", () => {
    for (const tier of ["Free", "Basic"] as const) {
      const result = selectApplicableCoupons({
        tier,
        coupons: [platform10, vendorA20],
        orderVendorId: VENDOR_A,
      });
      expect(result.applied.map((c) => c.code)).toEqual(["V20"]);
      expect(result.rejected).toContainEqual({ code: "P10", reason: "stacking_requires_plus" });
    }
  });

  it("never more than one coupon per source, even for Premium", () => {
    const result = selectApplicableCoupons({
      tier: "Premium",
      coupons: [platform10, platform15, vendorA20],
      orderVendorId: VENDOR_A,
    });
    expect(result.applied.map((c) => c.code).sort()).toEqual(["P15", "V20"]);
    expect(result.rejected).toContainEqual({ code: "P10", reason: "one_platform_coupon_max" });
  });

  it("vendor coupon must match the order's vendor", () => {
    const result = selectApplicableCoupons({
      tier: "Premium",
      coupons: [vendorA20],
      orderVendorId: VENDOR_B,
    });
    expect(result.applied).toEqual([]);
    expect(result.rejected).toContainEqual({ code: "V20", reason: "wrong_vendor" });
  });

  it("rejects redeemed/expired coupons", () => {
    const redeemed = coupon({ code: "USED", status: "redeemed" });
    const expired = coupon({ code: "OLD", expires_at: "2026-01-01T00:00:00Z" });
    const result = selectApplicableCoupons({
      tier: "Premium",
      coupons: [redeemed, expired],
      orderVendorId: VENDOR_A,
      now: new Date("2026-07-10T00:00:00Z"),
    });
    expect(result.applied).toEqual([]);
    expect(result.rejected).toContainEqual({ code: "USED", reason: "not_active" });
    expect(result.rejected).toContainEqual({ code: "OLD", reason: "expired" });
  });
});

describe("computeDiscountCents — 25% hard cap (clamp, never reject)", () => {
  it("applies summed percentages under the cap", () => {
    // $100 subtotal, 10% + 15% = 25% → exactly at cap, no clamping needed
    const result = computeDiscountCents(10000, [
      { percent_off: 10 },
      { percent_off: 15 },
    ]);
    expect(result).toEqual({ discountCents: 2500, effectivePct: 25, capApplied: false });
  });

  it("clamps stacked discounts above 25% to exactly 25%", () => {
    // 15% platform + 20% vendor = 35% → clamp to 25%
    const result = computeDiscountCents(10000, [
      { percent_off: 15 },
      { percent_off: 20 },
    ]);
    expect(result).toEqual({ discountCents: 2500, effectivePct: 25, capApplied: true });
  });

  it("floors fractional cents — never rounds a discount up", () => {
    // $9.99 at 5% = 49.95¢ → 49
    expect(computeDiscountCents(999, [{ percent_off: 5 }]).discountCents).toBe(49);
  });

  it("zero for empty coupons or non-positive subtotal", () => {
    expect(computeDiscountCents(10000, []).discountCents).toBe(0);
    expect(computeDiscountCents(0, [{ percent_off: 10 }]).discountCents).toBe(0);
  });
});

describe("generateCouponCode", () => {
  it("emits GHD-XXXXXXXX with an unambiguous alphabet", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCouponCode()).toMatch(/^GHD-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });
});
