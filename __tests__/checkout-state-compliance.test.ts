import { describe, it, expect } from "vitest";
import {
  isDeliveryAllowedForCategory,
  isSaleAllowedForCategory,
  type HempStateRule,
} from "@/lib/server/hempStateRules";

/**
 * Checkout uses fulfillment_method (single source of truth). For delivery we block if
 * EITHER delivery or sale is disallowed. These tests ensure state compliance logic:
 * - Delivery implies sale; both must be allowed for delivery.
 * - Bypass attempt (delivery_selected false but fulfillment_method 'delivery') still
 *   triggers delivery path because route uses fulfillmentMethod, not delivery_selected.
 */

const baseRule: HempStateRule = {
  state_code: "TX",
  allows_sale_non_intoxicating: true,
  allows_delivery_non_intoxicating: true,
  allows_sale_intoxicating: true,
  allows_delivery_intoxicating: true,
  notes: null,
  sources: [],
  last_verified_at: null,
};

describe("checkout state compliance", () => {
  it("delivery blocked when allows_delivery_intoxicating true but allows_sale_intoxicating false", () => {
    const rule: HempStateRule = {
      ...baseRule,
      allows_delivery_intoxicating: true,
      allows_sale_intoxicating: false,
    };
    const isIntoxicating = true;
    const deliveryAllowed = isDeliveryAllowedForCategory(rule, isIntoxicating);
    const saleAllowed = isSaleAllowedForCategory(rule, isIntoxicating);
    expect(deliveryAllowed).toBe(true);
    expect(saleAllowed).toBe(false);
    // Checkout blocks delivery when either is false
    const wouldBlockDelivery = !deliveryAllowed || !saleAllowed;
    expect(wouldBlockDelivery).toBe(true);
  });

  it("delivery allowed only when both delivery and sale allowed for category", () => {
    const rule: HempStateRule = {
      ...baseRule,
      allows_delivery_intoxicating: true,
      allows_sale_intoxicating: true,
    };
    const isIntoxicating = true;
    const deliveryAllowed = isDeliveryAllowedForCategory(rule, isIntoxicating);
    const saleAllowed = isSaleAllowedForCategory(rule, isIntoxicating);
    const wouldBlockDelivery = !deliveryAllowed || !saleAllowed;
    expect(wouldBlockDelivery).toBe(false);
  });

  it("delivery blocked when delivery disallowed even if sale allowed", () => {
    const rule: HempStateRule = {
      ...baseRule,
      allows_delivery_intoxicating: false,
      allows_sale_intoxicating: true,
    };
    const isIntoxicating = true;
    const deliveryAllowed = isDeliveryAllowedForCategory(rule, isIntoxicating);
    const saleAllowed = isSaleAllowedForCategory(rule, isIntoxicating);
    const wouldBlockDelivery = !deliveryAllowed || !saleAllowed;
    expect(wouldBlockDelivery).toBe(true);
  });

  it("fulfillment_method delivery uses both checks (not delivery_selected)", () => {
    // Route logic: fulfillmentMethod is derived from body.fulfillment_method first,
    // then fallback to delivery_selected. So body.fulfillment_method: "delivery"
    // with delivery_selected: false still yields fulfillmentMethod === "delivery"
    // and triggers delivery path. This test documents that the block condition
    // is (deliveryAllowed && saleAllowed); if either fails we return STATE_COMPLIANCE_BLOCK.
    const rule: HempStateRule = { ...baseRule, allows_sale_intoxicating: false };
    const blockDelivery = (r: HempStateRule | null, isIntox: boolean) =>
      !isDeliveryAllowedForCategory(r, isIntox) || !isSaleAllowedForCategory(r, isIntox);
    expect(blockDelivery(rule, true)).toBe(true);
    expect(blockDelivery(rule, false)).toBe(false);
  });
});
