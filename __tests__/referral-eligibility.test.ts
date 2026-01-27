import { describe, expect, it } from "vitest";
import {
  isReferralLinkEligible,
  isStarterConsumerPlanKey,
} from "@/lib/referral-eligibility";

describe("referral eligibility", () => {
  it("allows referral links for starter consumers", () => {
    expect(isStarterConsumerPlanKey("consumer_starter_monthly")).toBe(true);
    expect(isStarterConsumerPlanKey("consumer_starter_annual")).toBe(true);
  });

  it("blocks referral links for plus/vip consumers", () => {
    expect(isStarterConsumerPlanKey("consumer_plus_monthly")).toBe(false);
    expect(isStarterConsumerPlanKey("consumer_vip_annual")).toBe(false);
  });

  it("allows admins and vendors", () => {
    expect(
      isReferralLinkEligible({
        isAdmin: true,
        consumerPlanKey: null,
        isVendorSubscribed: false,
      })
    ).toBe(true);
    expect(
      isReferralLinkEligible({
        isAdmin: false,
        consumerPlanKey: null,
        isVendorSubscribed: true,
      })
    ).toBe(true);
  });

  it("blocks non-starter consumers without vendor access", () => {
    expect(
      isReferralLinkEligible({
        isAdmin: false,
        consumerPlanKey: "consumer_plus_monthly",
        isVendorSubscribed: false,
      })
    ).toBe(false);
  });
});
