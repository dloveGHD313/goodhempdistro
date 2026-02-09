/**
 * Phase 3B: Stripe subscription status → vendor_status (unit, no Stripe network).
 * Locks getDesiredVendorStatusFromSubscription: active/trialing => "active"; else preserve current.
 */
import { describe, expect, it } from "vitest";
import {
  getDesiredVendorStatusFromSubscription,
  VENDOR_ACTIVE_SUBSCRIPTION_STATUSES,
} from "@/lib/stripe/vendorStatusFromSubscription";

describe("Phase 3B: getDesiredVendorStatusFromSubscription", () => {
  it("active => desired vendor_status is active", () => {
    expect(getDesiredVendorStatusFromSubscription("active", null)).toBe("active");
    expect(getDesiredVendorStatusFromSubscription("active", "pending")).toBe("active");
    expect(getDesiredVendorStatusFromSubscription("active", "active")).toBe("active");
  });

  it("trialing => desired vendor_status is active", () => {
    expect(getDesiredVendorStatusFromSubscription("trialing", null)).toBe("active");
    expect(getDesiredVendorStatusFromSubscription("trialing", "pending")).toBe("active");
  });

  it("non-active status returns current (no new values)", () => {
    expect(getDesiredVendorStatusFromSubscription("canceled", "active")).toBe("active");
    expect(getDesiredVendorStatusFromSubscription("past_due", "pending")).toBe("pending");
    expect(getDesiredVendorStatusFromSubscription("unpaid", null)).toBeNull();
    expect(getDesiredVendorStatusFromSubscription("incomplete", null)).toBeNull();
    expect(getDesiredVendorStatusFromSubscription(null, "active")).toBe("active");
    expect(getDesiredVendorStatusFromSubscription("", "pending")).toBe("pending");
  });

  it("VENDOR_ACTIVE_SUBSCRIPTION_STATUSES contains active and trialing only", () => {
    expect(VENDOR_ACTIVE_SUBSCRIPTION_STATUSES.has("active")).toBe(true);
    expect(VENDOR_ACTIVE_SUBSCRIPTION_STATUSES.has("trialing")).toBe(true);
    expect(VENDOR_ACTIVE_SUBSCRIPTION_STATUSES.has("canceled")).toBe(false);
    expect(VENDOR_ACTIVE_SUBSCRIPTION_STATUSES.size).toBe(2);
  });
});
