import { describe, it, expect } from "vitest";
import { evaluateVendorActive, isCompActive } from "@/lib/server/isVendorActive";
import { computeCompUntil, MAX_COMP_MONTHS, COMP_DEFAULT_PLAN_KEY } from "@/lib/server/vendorComp";

const NOW = new Date("2026-09-02T18:00:00Z");
const FUTURE = "2027-09-02T18:00:00.000Z";
const PAST = "2026-01-01T00:00:00.000Z";

const baseVendor = {
  status: "active",
  is_approved: true,
  subscription_status: null,
  stripe_subscription_id: null,
};

describe("isCompActive", () => {
  it("is false when no comp window is set", () => {
    expect(isCompActive(null, NOW)).toBe(false);
    expect(isCompActive(undefined, NOW)).toBe(false);
    expect(isCompActive("", NOW)).toBe(false);
  });
  it("is true while the window is in the future", () => {
    expect(isCompActive(FUTURE, NOW)).toBe(true);
  });
  it("is false once the window has passed", () => {
    expect(isCompActive(PAST, NOW)).toBe(false);
  });
  it("is false for garbage timestamps", () => {
    expect(isCompActive("not-a-date", NOW)).toBe(false);
  });
});

describe("evaluateVendorActive with comp", () => {
  it("admin-activated vendor with no Stripe sub and no comp is NOT active (unchanged behavior)", () => {
    expect(evaluateVendorActive(null, { ...baseVendor }, NOW)).toBe(false);
  });
  it("comped founding vendor is active without any Stripe subscription", () => {
    expect(evaluateVendorActive(null, { ...baseVendor, comp_until: FUTURE }, NOW)).toBe(true);
  });
  it("expired comp falls back to normal rules", () => {
    expect(evaluateVendorActive(null, { ...baseVendor, comp_until: PAST }, NOW)).toBe(false);
  });
  it("SSOT active still wins regardless of comp", () => {
    expect(evaluateVendorActive("active", { ...baseVendor, comp_until: PAST }, NOW)).toBe(true);
  });
  it("real Stripe subscription still works with no comp", () => {
    expect(
      evaluateVendorActive(null, {
        ...baseVendor,
        subscription_status: "active",
        stripe_subscription_id: "sub_123",
      }, NOW),
    ).toBe(true);
  });
});

describe("computeCompUntil", () => {
  it("returns null when no months requested", () => {
    expect(computeCompUntil(undefined, NOW)).toBeNull();
    expect(computeCompUntil(0, NOW)).toBeNull();
    expect(computeCompUntil(-3, NOW)).toBeNull();
    expect(computeCompUntil("abc", NOW)).toBeNull();
  });
  it("adds calendar months (founding year = 12)", () => {
    expect(computeCompUntil(12, NOW)).toBe("2027-09-02T18:00:00.000Z");
    expect(computeCompUntil("3", NOW)).toBe("2026-12-02T18:00:00.000Z");
  });
  it("caps at MAX_COMP_MONTHS", () => {
    expect(computeCompUntil(999, NOW)).toBe(computeCompUntil(MAX_COMP_MONTHS, NOW));
  });
  it("defaults comped vendors to the Starter plan key", () => {
    expect(COMP_DEFAULT_PLAN_KEY).toBe("vendor_starter_annual");
  });
});

describe("founding-vendor checkout guard (comp-aware checkout)", async () => {
  const { compedCheckoutBlock, formatCompUntil, isCompWindowOpen } = await import("@/lib/server/vendorComp");
  const NOW = new Date("2026-09-06T03:00:00Z");

  it("blocks paid checkout while the comp window is open", () => {
    const block = compedCheckoutBlock("2027-09-02T18:00:00Z", NOW);
    expect(block).not.toBeNull();
    expect(block?.compUntil).toBe("2027-09-02T18:00:00Z");
    expect(block?.until).toBe("Sep 2, 2027");
    expect(block?.message).toMatch(/free until Sep 2, 2027/);
    expect(block?.message).toMatch(/no subscription needed/i);
  });

  it("lets checkout through once the comp window has ended or was never set", () => {
    expect(compedCheckoutBlock("2026-09-01T00:00:00Z", NOW)).toBeNull();
    expect(compedCheckoutBlock(null, NOW)).toBeNull();
    expect(compedCheckoutBlock(undefined, NOW)).toBeNull();
    expect(compedCheckoutBlock("not-a-date", NOW)).toBeNull();
  });

  it("window helper and date label agree with isCompActive semantics", () => {
    expect(isCompWindowOpen("2027-01-01T00:00:00Z", NOW)).toBe(true);
    expect(isCompWindowOpen("2026-09-06T02:59:59Z", NOW)).toBe(false);
    expect(formatCompUntil("2027-01-01T00:00:00Z")).toBe("Jan 1, 2027");
    expect(formatCompUntil("garbage")).toBeNull();
    expect(formatCompUntil(null)).toBeNull();
  });
});
