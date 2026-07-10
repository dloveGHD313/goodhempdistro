import { describe, it, expect } from "vitest";
import { evaluateBuyGate } from "@/lib/products/buyGate";

/**
 * P0 regression contract (storefront audit 2026-07-10):
 * COA gates purchase ONLY when the category requires one. The old inline
 * logic required an uploaded COA on every product, making COA-exempt
 * apparel (Clothing, requires_coa=false) unbuyable.
 */

const buyable = {
  stripeEnabled: true,
  hasPriceCents: true,
  hasCoa: false,
  categoryRequiresCoa: false,
  isApprovedActive: true,
};

describe("evaluateBuyGate — the P0 case", () => {
  it("COA-exempt category with NO uploaded COA is BUYABLE (the GHD Tee case)", () => {
    const result = evaluateBuyGate(buyable);
    expect(result.disabled).toBe(false);
    expect(result.buyButtonMessage).toBeNull();
    expect(result.availabilityMessage).toBeNull();
  });

  it("COA-required category with NO COA stays correctly BLOCKED", () => {
    const result = evaluateBuyGate({ ...buyable, categoryRequiresCoa: true });
    expect(result.disabled).toBe(true);
    expect(result.buyButtonMessage).toBe("COA required before purchase.");
    expect(result.availabilityMessage).toBe("COA required before purchase.");
  });

  it("COA-required category WITH an uploaded COA is buyable", () => {
    const result = evaluateBuyGate({ ...buyable, categoryRequiresCoa: true, hasCoa: true });
    expect(result.disabled).toBe(false);
    expect(result.buyButtonMessage).toBeNull();
  });

  it("COA-exempt category with an (optional) COA uploaded is also buyable", () => {
    const result = evaluateBuyGate({ ...buyable, hasCoa: true });
    expect(result.disabled).toBe(false);
  });
});

describe("evaluateBuyGate — other blockers unchanged", () => {
  it("missing price blocks with price message", () => {
    const result = evaluateBuyGate({ ...buyable, hasPriceCents: false });
    expect(result.disabled).toBe(true);
    expect(result.buyButtonMessage).toBe("Price unavailable.");
  });

  it("stripe not configured blocks with checkout message", () => {
    const result = evaluateBuyGate({ ...buyable, stripeEnabled: false });
    expect(result.disabled).toBe(true);
    expect(result.buyButtonMessage).toBe("Checkout is not configured.");
  });

  it("unapproved/inactive product blocks; availability message differs from button message", () => {
    const result = evaluateBuyGate({ ...buyable, isApprovedActive: false });
    expect(result.disabled).toBe(true);
    expect(result.buyButtonMessage).toBe("Product unavailable.");
    expect(result.availabilityMessage).toBe("This product is not currently available.");
  });

  it("COA reason takes priority over other blockers (matches original ordering)", () => {
    const result = evaluateBuyGate({
      stripeEnabled: false,
      hasPriceCents: false,
      hasCoa: false,
      categoryRequiresCoa: true,
      isApprovedActive: false,
    });
    expect(result.buyButtonMessage).toBe("COA required before purchase.");
  });
});
