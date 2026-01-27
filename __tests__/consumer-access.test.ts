import { describe, expect, it } from "vitest";
import { isConsumerSubscriptionActive } from "@/lib/consumer-access";

describe("consumer subscription access", () => {
  it("treats active and trialing as subscribed", () => {
    expect(isConsumerSubscriptionActive("active")).toBe(true);
    expect(isConsumerSubscriptionActive("trialing")).toBe(true);
  });

  it("rejects non-active statuses", () => {
    expect(isConsumerSubscriptionActive("canceled")).toBe(false);
    expect(isConsumerSubscriptionActive("past_due")).toBe(false);
    expect(isConsumerSubscriptionActive(null)).toBe(false);
  });
});
