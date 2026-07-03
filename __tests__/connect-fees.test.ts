import { describe, it, expect, vi } from "vitest";
import { getPlatformFeeForCheckout } from "@/lib/billing/connectFees";
import { COMMISSION_RATES } from "@/lib/referral";

/**
 * P0-1 regression contract — reserve-transfer model.
 *
 * Checkout NO LONGER creates Stripe Connect destination charges (the old
 * buildPaymentIntentData path double-paid vendors: once at charge time via
 * transfer_data, once again 7 days later via the reserve cron). The full
 * charge settles on the platform; getPlatformFeeForCheckout computes fee
 * metadata from the vendor's TIER ALONE — deliberately independent of
 * Connect-account health, so vendors mid-onboarding still accrue reserves.
 * The cron enforces Connect eligibility exactly once, at transfer time.
 */

const VENDOR_ID = "24a1bd8e-dbd8-484c-9c3a-b004f4e9588f";

/** Minimal Supabase mock — supports .from("vendors").select().eq().maybeSingle() */
function mockAdmin(vendorRow: { tier?: string | null } | null) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: vendorRow, error: null }),
  };
  return {
    from(table: string) {
      if (table === "vendors") return builder;
      throw new Error(`unexpected table ${table} — fee computation must only read vendors`);
    },
  };
}

const ctx = (subtotalCents = 10000) => ({
  vendorId: VENDOR_ID,
  productSubtotalCents: subtotalCents,
});

describe("getPlatformFeeForCheckout — happy paths (tier-only computation)", () => {
  it("starter tier: $100 product → 700 bps → $7.00 platform fee", async () => {
    const result = await getPlatformFeeForCheckout(mockAdmin({ tier: "starter" }), ctx(10000));
    expect(result).not.toBeNull();
    expect(result!.tier).toBe("starter");
    expect(result!.feeBps).toBe(COMMISSION_RATES.starter); // 700
    expect(result!.applicationFeeAmount).toBe(700);
  });

  it("mid tier: $100 product → 500 bps → $5.00 platform fee", async () => {
    const result = await getPlatformFeeForCheckout(mockAdmin({ tier: "mid" }), ctx(10000));
    expect(result!.tier).toBe("mid");
    expect(result!.applicationFeeAmount).toBe(500);
  });

  it("top tier: $100 product → 100 bps → $1.00 platform fee", async () => {
    const result = await getPlatformFeeForCheckout(mockAdmin({ tier: "top" }), ctx(10000));
    expect(result!.tier).toBe("top");
    expect(result!.applicationFeeAmount).toBe(100);
  });

  it("rounds DOWN (never overcharges vendor) on fractional cents", async () => {
    // 9999 cents * 700 bps / 10000 = 699.93 → floored to 699
    const result = await getPlatformFeeForCheckout(mockAdmin({ tier: "starter" }), ctx(9999));
    expect(result!.applicationFeeAmount).toBe(699);
  });

  it("does NOT depend on Connect-account health (vendor mid-onboarding still gets fee metadata)", async () => {
    // The mock throws if any table other than vendors is read — passing
    // proves the function never consults vendor_connect_accounts.
    const result = await getPlatformFeeForCheckout(mockAdmin({ tier: "mid" }), ctx(10000));
    expect(result).not.toBeNull();
  });
});

describe("getPlatformFeeForCheckout — failure modes return null + warn", () => {
  it("returns null when vendor row missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await getPlatformFeeForCheckout(mockAdmin(null), ctx());
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("returns null when tier is null", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await getPlatformFeeForCheckout(mockAdmin({ tier: null }), ctx());
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it("returns null when tier is not in (starter|mid|top)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await getPlatformFeeForCheckout(mockAdmin({ tier: "premium" }), ctx());
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it("returns null when vendorId is empty", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await getPlatformFeeForCheckout(mockAdmin({ tier: "starter" }), {
      vendorId: "",
      productSubtotalCents: 10000,
    });
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it("returns null when subtotal is 0, negative, or NaN", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await getPlatformFeeForCheckout(mockAdmin({ tier: "starter" }), ctx(0))).toBeNull();
    expect(await getPlatformFeeForCheckout(mockAdmin({ tier: "starter" }), ctx(-50))).toBeNull();
    expect(await getPlatformFeeForCheckout(mockAdmin({ tier: "starter" }), ctx(Number.NaN))).toBeNull();
    warnSpy.mockRestore();
  });
});

describe("P0-1 guard — destination-charge API must stay deleted", () => {
  it("the module no longer exports buildPaymentIntentData or getConnectFeeForCheckout", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = (await import("@/lib/billing/connectFees")) as any;
    expect(mod.buildPaymentIntentData).toBeUndefined();
    expect(mod.getConnectFeeForCheckout).toBeUndefined();
  });
});

describe("Per-tier fee table matches COMMISSION_RATES", () => {
  it("starter = 700 bps (7%)", () => expect(COMMISSION_RATES.starter).toBe(700));
  it("mid = 500 bps (5%)", () => expect(COMMISSION_RATES.mid).toBe(500));
  it("top = 100 bps (1%)", () => expect(COMMISSION_RATES.top).toBe(100));
});
