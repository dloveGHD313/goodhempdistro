import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import {
  getSubPeriodEndISO,
  getSubPeriodStartISO,
  resolveInvoiceSubscriptionId,
} from "@/lib/stripe/subscriptionCompat";

/**
 * P0-0 regression contract — Stripe API version drift.
 *
 * The live webhook endpoint delivers payloads at the Dashboard-configured
 * API version, which can be newer than the pinned SDK version
 * (2024-11-20.acacia). Both payload shapes MUST be tolerated:
 *
 *   OLD: subscription.current_period_end at top level;
 *        invoice.subscription at top level
 *   NEW: subscription.items.data[0].current_period_end;
 *        invoice.parent.subscription_details.subscription
 *
 * Production failure 2026-07-03: `new Date(undefined * 1000).toISOString()`
 * threw RangeError: Invalid time value on every customer.subscription.*
 * event → webhook 500 → renewals/cancellations never synced.
 */

const TS = 1782000000; // some finite unix seconds
const TS_ISO = new Date(TS * 1000).toISOString();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asSub = (obj: any) => obj as Stripe.Subscription;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asInvoice = (obj: any) => obj as Stripe.Invoice;

describe("getSubPeriodEndISO", () => {
  it("OLD shape: reads top-level current_period_end", () => {
    expect(getSubPeriodEndISO(asSub({ current_period_end: TS }))).toBe(TS_ISO);
  });

  it("NEW shape: reads items.data[0].current_period_end", () => {
    expect(
      getSubPeriodEndISO(asSub({ items: { data: [{ current_period_end: TS }] } })),
    ).toBe(TS_ISO);
  });

  it("prefers top-level when both present (old-shape precedence)", () => {
    expect(
      getSubPeriodEndISO(
        asSub({ current_period_end: TS, items: { data: [{ current_period_end: TS + 999 }] } }),
      ),
    ).toBe(TS_ISO);
  });

  it("returns null when absent everywhere (the P0-0 crash case)", () => {
    expect(getSubPeriodEndISO(asSub({}))).toBeNull();
    expect(getSubPeriodEndISO(asSub({ items: { data: [] } }))).toBeNull();
    expect(getSubPeriodEndISO(asSub({ items: { data: [{}] } }))).toBeNull();
  });

  it("returns null on non-finite garbage instead of throwing", () => {
    expect(getSubPeriodEndISO(asSub({ current_period_end: Number.NaN }))).toBeNull();
    expect(getSubPeriodEndISO(asSub({ current_period_end: Infinity }))).toBeNull();
    expect(getSubPeriodEndISO(asSub({ current_period_end: "soon" }))).toBeNull();
  });
});

describe("getSubPeriodStartISO", () => {
  it("OLD shape: top-level current_period_start", () => {
    expect(getSubPeriodStartISO(asSub({ current_period_start: TS }))).toBe(TS_ISO);
  });

  it("NEW shape: items.data[0].current_period_start", () => {
    expect(
      getSubPeriodStartISO(asSub({ items: { data: [{ current_period_start: TS }] } })),
    ).toBe(TS_ISO);
  });

  it("returns null when absent (never throws)", () => {
    expect(getSubPeriodStartISO(asSub({}))).toBeNull();
  });
});

describe("resolveInvoiceSubscriptionId", () => {
  it("OLD shape: invoice.subscription as string", () => {
    expect(resolveInvoiceSubscriptionId(asInvoice({ subscription: "sub_123" }))).toBe("sub_123");
  });

  it("OLD shape: invoice.subscription as expanded object", () => {
    expect(resolveInvoiceSubscriptionId(asInvoice({ subscription: { id: "sub_456" } }))).toBe("sub_456");
  });

  it("NEW shape: invoice.parent.subscription_details.subscription as string", () => {
    expect(
      resolveInvoiceSubscriptionId(
        asInvoice({ parent: { subscription_details: { subscription: "sub_789" } } }),
      ),
    ).toBe("sub_789");
  });

  it("NEW shape: nested expanded object", () => {
    expect(
      resolveInvoiceSubscriptionId(
        asInvoice({ parent: { subscription_details: { subscription: { id: "sub_abc" } } } }),
      ),
    ).toBe("sub_abc");
  });

  it("returns null for one-off invoices with no subscription anywhere", () => {
    expect(resolveInvoiceSubscriptionId(asInvoice({}))).toBeNull();
    expect(resolveInvoiceSubscriptionId(asInvoice({ subscription: null }))).toBeNull();
    expect(resolveInvoiceSubscriptionId(asInvoice({ parent: {} }))).toBeNull();
    expect(resolveInvoiceSubscriptionId(asInvoice({ subscription: "" }))).toBeNull();
  });

  it("old shape wins when both present", () => {
    expect(
      resolveInvoiceSubscriptionId(
        asInvoice({
          subscription: "sub_old",
          parent: { subscription_details: { subscription: "sub_new" } },
        }),
      ),
    ).toBe("sub_old");
  });
});
