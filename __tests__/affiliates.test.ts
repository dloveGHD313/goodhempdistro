import { describe, it, expect } from "vitest";
import {
  generateAffiliateCode,
  calculateAffiliateReward,
} from "@/lib/affiliates";

describe("Affiliate System", () => {
  describe("generateAffiliateCode", () => {
    it("generates a unique code from user ID", () => {
      const userId = "abcd1234-5678-90ef-ghij-klmnopqrstuv";
      const code = generateAffiliateCode(userId);

      expect(code).toContain("ABCD1234");
      expect(code).toMatch(/^[A-Z0-9]{8}-[A-Z0-9]{4}$/);
    });

    it("generates different codes for different users", () => {
      const code1 = generateAffiliateCode("user-id-1");
      const code2 = generateAffiliateCode("user-id-2");

      expect(code1).not.toBe(code2);
    });
  });

  describe("calculateAffiliateReward", () => {
    it("returns $5 (500 cents) for STARTER package", () => {
      expect(calculateAffiliateReward("STARTER")).toBe(500);
    });

    it("returns $15 (1500 cents) for PLUS package", () => {
      expect(calculateAffiliateReward("PLUS")).toBe(1500);
    });

    it("returns $25 (2500 cents) for VIP package", () => {
      expect(calculateAffiliateReward("VIP")).toBe(2500);
    });

    it("returns $5 (500 cents) for BASIC vendor package", () => {
      expect(calculateAffiliateReward("BASIC")).toBe(500);
    });

    it("returns $15 (1500 cents) for PRO vendor package", () => {
      expect(calculateAffiliateReward("PRO")).toBe(1500);
    });

    it("returns $25 (2500 cents) for ELITE vendor package", () => {
      expect(calculateAffiliateReward("ELITE")).toBe(2500);
    });

    it("returns default $5 (500 cents) for unknown package", () => {
      expect(calculateAffiliateReward("UNKNOWN")).toBe(500);
    });

    it("handles case-insensitive package names", () => {
      expect(calculateAffiliateReward("vip")).toBe(2500);
      expect(calculateAffiliateReward("VIP")).toBe(2500);
      expect(calculateAffiliateReward("Vip")).toBe(2500);
    });
  });
});
