import { describe, expect, it } from "vitest";
import {
  eventTicketDiscountCents,
  isTicketSalesOpenForTier,
  quarterKey,
} from "@/lib/events/perks";

describe("eventTicketDiscountCents (spec §7, verification #7)", () => {
  it("applies 0/5/10/20% by tier, floor rounding", () => {
    expect(eventTicketDiscountCents(10000, "Free")).toBe(0);
    expect(eventTicketDiscountCents(10000, "Basic")).toBe(500);
    expect(eventTicketDiscountCents(10000, "Plus")).toBe(1000);
    expect(eventTicketDiscountCents(10000, "Premium")).toBe(2000);
    // $9.99 at 5% = 49.95¢ → 49
    expect(eventTicketDiscountCents(999, "Basic")).toBe(49);
  });

  it("zero for non-positive subtotals", () => {
    expect(eventTicketDiscountCents(0, "Premium")).toBe(0);
  });
});

describe("isTicketSalesOpenForTier — early window 0/0/24/48h", () => {
  const ON_SALE = "2026-07-20T00:00:00Z"; // public on-sale

  it("null on-sale time: open to everyone immediately", () => {
    const result = isTicketSalesOpenForTier(null, "Free");
    expect(result.open).toBe(true);
    expect(result.opensAt).toBeNull();
  });

  it("49h early: closed to everyone", () => {
    const now = new Date("2026-07-17T23:00:00Z");
    for (const tier of ["Free", "Basic", "Plus", "Premium"] as const) {
      expect(isTicketSalesOpenForTier(ON_SALE, tier, now).open).toBe(false);
    }
  });

  it("47h early: Premium only; 23h early: Plus and Premium", () => {
    const at47h = new Date("2026-07-18T01:00:00Z");
    expect(isTicketSalesOpenForTier(ON_SALE, "Premium", at47h).open).toBe(true);
    expect(isTicketSalesOpenForTier(ON_SALE, "Plus", at47h).open).toBe(false);

    const at23h = new Date("2026-07-19T01:00:00Z");
    expect(isTicketSalesOpenForTier(ON_SALE, "Plus", at23h).open).toBe(true);
    expect(isTicketSalesOpenForTier(ON_SALE, "Basic", at23h).open).toBe(false);
    expect(isTicketSalesOpenForTier(ON_SALE, "Free", at23h).open).toBe(false);
  });

  it("at/after public on-sale: open to all, with opensAt reported", () => {
    const now = new Date(ON_SALE);
    for (const tier of ["Free", "Basic"] as const) {
      const result = isTicketSalesOpenForTier(ON_SALE, tier, now);
      expect(result.open).toBe(true);
      expect(result.opensAt?.toISOString()).toBe("2026-07-20T00:00:00.000Z");
    }
  });
});

describe("quarterKey", () => {
  it("maps months to UTC quarters", () => {
    expect(quarterKey(new Date("2026-01-15T00:00:00Z"))).toBe("2026-Q1");
    expect(quarterKey(new Date("2026-07-10T00:00:00Z"))).toBe("2026-Q3");
    expect(quarterKey(new Date("2026-12-31T23:59:59Z"))).toBe("2026-Q4");
  });
});
