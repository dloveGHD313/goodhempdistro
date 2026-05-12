import { describe, it, expect, vi } from "vitest";
import {
  buildPaymentIntentData,
  getConnectFeeForCheckout,
} from "@/lib/billing/connectFees";
import { COMMISSION_RATES } from "@/lib/referral";

const VENDOR_ID = "24a1bd8e-dbd8-484c-9c3a-b004f4e9588f";
const VENDOR_OWNER = "224b8688-dc88-40cd-be58-4d4f74625a5b";
const STRIPE_ACCT = "acct_1TestExpressAccount";

/** Minimal Supabase mock — supports the .from().select().eq().maybeSingle() chain we use. */
function mockAdmin(handlers: {
  vendor_connect_accounts?: { stripe_account_id?: string; charges_enabled?: boolean; payouts_enabled?: boolean } | null;
  vendors?: { tier?: string | null } | null;
}) {
  const mkBuilder = (data: unknown) => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => ({ data, error: null }),
    };
    return builder;
  };
  return {
    from(table: string) {
      if (table === "vendor_connect_accounts") return mkBuilder(handlers.vendor_connect_accounts ?? null);
      if (table === "vendors") return mkBuilder(handlers.vendors ?? null);
      throw new Error(`unexpected table ${table}`);
    },
  };
}

const ctx = (subtotalCents = 10000) => ({
  vendorId: VENDOR_ID,
  vendorOwnerUserId: VENDOR_OWNER,
  productSubtotalCents: subtotalCents,
});

describe("getConnectFeeForCheckout — happy paths", () => {
  it("starter tier: $100 product → 700 bps → $7.00 platform fee", async () => {
    const admin = mockAdmin({
      vendor_connect_accounts: { stripe_account_id: STRIPE_ACCT, charges_enabled: true, payouts_enabled: true },
      vendors: { tier: "starter" },
    });
    const result = await getConnectFeeForCheckout(admin, ctx(10000));
    expect(result).not.toBeNull();
    expect(result!.destination).toBe(STRIPE_ACCT);
    expect(result!.tier).toBe("starter");
    expect(result!.feeBps).toBe(COMMISSION_RATES.starter); // 700
    expect(result!.applicationFeeAmount).toBe(700); // 10000 * 700 / 10000 = 700 cents
  });

  it("mid tier: $100 product → 500 bps → $5.00 platform fee", async () => {
    const admin = mockAdmin({
      vendor_connect_accounts: { stripe_account_id: STRIPE_ACCT, charges_enabled: true, payouts_enabled: true },
      vendors: { tier: "mid" },
    });
    const result = await getConnectFeeForCheckout(admin, ctx(10000));
    expect(result!.tier).toBe("mid");
    expect(result!.applicationFeeAmount).toBe(500);
  });

  it("top tier: $100 product → 100 bps → $1.00 platform fee", async () => {
    const admin = mockAdmin({
      vendor_connect_accounts: { stripe_account_id: STRIPE_ACCT, charges_enabled: true, payouts_enabled: true },
      vendors: { tier: "top" },
    });
    const result = await getConnectFeeForCheckout(admin, ctx(10000));
    expect(result!.tier).toBe("top");
    expect(result!.applicationFeeAmount).toBe(100);
  });

  it("rounds DOWN (never overcharges vendor) on fractional cents", async () => {
    const admin = mockAdmin({
      vendor_connect_accounts: { stripe_account_id: STRIPE_ACCT, charges_enabled: true, payouts_enabled: true },
      vendors: { tier: "starter" },
    });
    // 9999 cents * 700 bps / 10000 = 699.93 → floored to 699
    const result = await getConnectFeeForCheckout(admin, ctx(9999));
    expect(result!.applicationFeeAmount).toBe(699);
  });
});

describe("getConnectFeeForCheckout — failure modes return null + warn", () => {
  it("returns null when vendor has no Connect account", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const admin = mockAdmin({
      vendor_connect_accounts: null,
      vendors: { tier: "starter" },
    });
    const result = await getConnectFeeForCheckout(admin, ctx());
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("no Connect account"),
      expect.any(Object),
    );
    warnSpy.mockRestore();
  });

  it("returns null when Connect account has charges_enabled=false", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const admin = mockAdmin({
      vendor_connect_accounts: { stripe_account_id: STRIPE_ACCT, charges_enabled: false, payouts_enabled: true },
      vendors: { tier: "starter" },
    });
    const result = await getConnectFeeForCheckout(admin, ctx());
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("returns null when Connect account has payouts_enabled=false (KYC incomplete)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const admin = mockAdmin({
      vendor_connect_accounts: { stripe_account_id: STRIPE_ACCT, charges_enabled: true, payouts_enabled: false },
      vendors: { tier: "starter" },
    });
    const result = await getConnectFeeForCheckout(admin, ctx());
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it("returns null when vendor row missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const admin = mockAdmin({
      vendor_connect_accounts: { stripe_account_id: STRIPE_ACCT, charges_enabled: true, payouts_enabled: true },
      vendors: null,
    });
    const result = await getConnectFeeForCheckout(admin, ctx());
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it("returns null when tier is null", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const admin = mockAdmin({
      vendor_connect_accounts: { stripe_account_id: STRIPE_ACCT, charges_enabled: true, payouts_enabled: true },
      vendors: { tier: null },
    });
    const result = await getConnectFeeForCheckout(admin, ctx());
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it("returns null when tier is not in (starter|mid|top)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const admin = mockAdmin({
      vendor_connect_accounts: { stripe_account_id: STRIPE_ACCT, charges_enabled: true, payouts_enabled: true },
      vendors: { tier: "premium" }, // invalid
    });
    const result = await getConnectFeeForCheckout(admin, ctx());
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it("returns null when vendorOwnerUserId is empty", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const admin = mockAdmin({});
    const result = await getConnectFeeForCheckout(admin, {
      vendorId: VENDOR_ID,
      vendorOwnerUserId: "",
      productSubtotalCents: 10000,
    });
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });

  it("returns null when subtotal is 0 or negative", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const admin = mockAdmin({
      vendor_connect_accounts: { stripe_account_id: STRIPE_ACCT, charges_enabled: true, payouts_enabled: true },
      vendors: { tier: "starter" },
    });
    const zero = await getConnectFeeForCheckout(admin, ctx(0));
    expect(zero).toBeNull();
    const negative = await getConnectFeeForCheckout(admin, ctx(-50));
    expect(negative).toBeNull();
    warnSpy.mockRestore();
  });

  it("returns null when subtotal is NaN", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const admin = mockAdmin({
      vendor_connect_accounts: { stripe_account_id: STRIPE_ACCT, charges_enabled: true, payouts_enabled: true },
      vendors: { tier: "starter" },
    });
    const result = await getConnectFeeForCheckout(admin, ctx(Number.NaN));
    expect(result).toBeNull();
    warnSpy.mockRestore();
  });
});

describe("buildPaymentIntentData", () => {
  it("returns undefined when no Connect fee (so checkout falls back to platform collection)", () => {
    expect(buildPaymentIntentData(null)).toBeUndefined();
  });

  it("builds the destination charge payload when fee is present", () => {
    const result = buildPaymentIntentData({
      destination: STRIPE_ACCT,
      applicationFeeAmount: 500,
      tier: "mid",
      feeBps: 500,
    });
    expect(result).toEqual({
      application_fee_amount: 500,
      transfer_data: { destination: STRIPE_ACCT },
      on_behalf_of: STRIPE_ACCT,
    });
  });
});

describe("Per-tier fee table matches COMMISSION_RATES", () => {
  it("starter = 700 bps (7%)", () => expect(COMMISSION_RATES.starter).toBe(700));
  it("mid = 500 bps (5%)", () => expect(COMMISSION_RATES.mid).toBe(500));
  it("top = 100 bps (1%)", () => expect(COMMISSION_RATES.top).toBe(100));
});
