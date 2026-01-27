import { describe, expect, it } from "vitest";
import { getConsumerAccessStatus, isConsumerSubscriptionActive } from "@/lib/consumer-access";

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

  it("returns admin bypass when email is allowed", async () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    const status = await getConsumerAccessStatus("user-id", "admin@example.com");
    expect(status.isAdmin).toBe(true);
    expect(status.isSubscribed).toBe(true);
  });
});
