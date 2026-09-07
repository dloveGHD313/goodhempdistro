import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { freshestSubscription } from "@/lib/stripe/subscriptionState";

const evt = (status: string) => ({ id: "sub_123", status } as unknown as Stripe.Subscription);

describe("freshestSubscription (webhook ordering guard)", () => {
  it("prefers Stripe's current state over a stale created/updated event", async () => {
    const stripe = { subscriptions: { retrieve: vi.fn(async () => evt("canceled")) } };
    const r = await freshestSubscription("customer.subscription.created", evt("incomplete"), stripe);
    expect(r.source).toBe("stripe");
    expect(r.subscription.status).toBe("canceled");
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_123");
  });

  it("uses the event payload for deleted events without a refetch", async () => {
    const stripe = { subscriptions: { retrieve: vi.fn() } };
    const r = await freshestSubscription("customer.subscription.deleted", evt("canceled"), stripe);
    expect(r.source).toBe("event");
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });

  it("falls back to the event payload when the refetch fails", async () => {
    const stripe = { subscriptions: { retrieve: vi.fn(async () => { throw new Error("boom"); }) } };
    const r = await freshestSubscription("customer.subscription.updated", evt("active"), stripe);
    expect(r.source).toBe("event");
    expect(r.subscription.status).toBe("active");
  });
});
