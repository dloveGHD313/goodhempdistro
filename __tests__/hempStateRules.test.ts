import { describe, it, expect } from "vitest";
import {
  isDeliveryAllowedForCategory,
  isSaleAllowedForCategory,
  type HempStateRule,
} from "@/lib/server/hempStateRules";

const ruleAllAllow: HempStateRule = {
  state_code: "CA",
  allows_sale_non_intoxicating: true,
  allows_delivery_non_intoxicating: true,
  allows_sale_intoxicating: true,
  allows_delivery_intoxicating: true,
  notes: null,
  sources: [],
  last_verified_at: null,
};

const ruleRestrictDelivery: HempStateRule = {
  ...ruleAllAllow,
  allows_delivery_intoxicating: false,
  allows_delivery_non_intoxicating: false,
};

describe("hempStateRules", () => {
  describe("isSaleAllowedForCategory", () => {
    it("returns true when no rule (default allow)", () => {
      expect(isSaleAllowedForCategory(null, false)).toBe(true);
      expect(isSaleAllowedForCategory(null, true)).toBe(true);
    });
    it("uses rule when present", () => {
      expect(isSaleAllowedForCategory(ruleAllAllow, false)).toBe(true);
      expect(isSaleAllowedForCategory(ruleAllAllow, true)).toBe(true);
      const noSaleIntox: HempStateRule = { ...ruleAllAllow, allows_sale_intoxicating: false };
      expect(isSaleAllowedForCategory(noSaleIntox, true)).toBe(false);
      expect(isSaleAllowedForCategory(noSaleIntox, false)).toBe(true);
    });
  });

  describe("isDeliveryAllowedForCategory", () => {
    it("returns false when no rule (default deny)", () => {
      expect(isDeliveryAllowedForCategory(null, false)).toBe(false);
      expect(isDeliveryAllowedForCategory(null, true)).toBe(false);
    });
    it("uses rule when present", () => {
      expect(isDeliveryAllowedForCategory(ruleAllAllow, false)).toBe(true);
      expect(isDeliveryAllowedForCategory(ruleAllAllow, true)).toBe(true);
      expect(isDeliveryAllowedForCategory(ruleRestrictDelivery, true)).toBe(false);
      expect(isDeliveryAllowedForCategory(ruleRestrictDelivery, false)).toBe(false);
    });
  });
});
