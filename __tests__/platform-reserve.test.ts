import { describe, it, expect, vi } from "vitest";
import {
  findDueReserves,
  markReserveReleased,
  queueOrderReserve,
  resolveDestinationAccount,
} from "@/lib/server/platformReserve";

type Captured = { table: string; method: string; args: unknown };

function mkAdmin(handlers: Record<
  string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { data?: any; error?: any; insertReturn?: any }
>) {
  const calls: Captured[] = [];
  const makeChain = (table: string): unknown => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {};
    const data = handlers[table]?.data ?? null;
    const error = handlers[table]?.error ?? null;
    chain.select = vi.fn((...args: unknown[]) => {
      calls.push({ table, method: "select", args });
      return chain;
    });
    chain.insert = vi.fn((...args: unknown[]) => {
      calls.push({ table, method: "insert", args });
      // For insert chains followed by .select().maybeSingle()
      return chain;
    });
    chain.update = vi.fn((...args: unknown[]) => {
      calls.push({ table, method: "update", args });
      return chain;
    });
    chain.eq = vi.fn(() => chain);
    chain.is = vi.fn(() => chain);
    chain.lte = vi.fn(() => chain);
    chain.gt = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(async () => {
      // For insert.select.maybeSingle chains, return insertReturn if set
      const insertCall = calls.filter((c) => c.table === table && c.method === "insert");
      if (insertCall.length > 0 && handlers[table]?.insertReturn !== undefined) {
        return { data: handlers[table].insertReturn, error };
      }
      return { data, error };
    });
    chain.then = (resolve: (v: unknown) => void) => {
      // For chains awaited directly (findDueReserves uses .limit() awaited)
      resolve({ data, error });
    };
    return chain;
  };
  return {
    calls,
    admin: { from: (table: string) => makeChain(table) },
  };
}

// ─────────────────────────────────────────────────────────────
// queueOrderReserve
// ─────────────────────────────────────────────────────────────

describe("queueOrderReserve", () => {
  it("inserts a row with held_until ≈ now + 7 days when none exists", async () => {
    const captured = mkAdmin({
      platform_reserve: {
        data: null, // de-dupe check returns null → no existing
        insertReturn: { id: "rsv_new" },
      },
    });
    const result = await queueOrderReserve(captured.admin, {
      vendor_id: "v-1",
      order_id: "ord-1",
      amount_cents: 5000,
    });
    expect(result).toEqual({ id: "rsv_new" });
    const insertCall = captured.calls.find((c) => c.table === "platform_reserve" && c.method === "insert");
    expect(insertCall).toBeTruthy();
    const payload = (insertCall!.args as unknown[])[0] as Record<string, unknown>;
    expect(payload.vendor_id).toBe("v-1");
    expect(payload.order_id).toBe("ord-1");
    expect(payload.amount_cents).toBe(5000);
    expect(payload.reason).toBe("order_completion");
    // held_until is roughly 7 days from now
    const heldUntilMs = new Date(payload.held_until as string).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(heldUntilMs - Date.now()).toBeGreaterThan(sevenDays - 10_000);
    expect(heldUntilMs - Date.now()).toBeLessThan(sevenDays + 10_000);
  });

  it("respects custom hold_days override", async () => {
    const captured = mkAdmin({
      platform_reserve: { data: null, insertReturn: { id: "rsv_x" } },
    });
    await queueOrderReserve(captured.admin, {
      vendor_id: "v-1",
      order_id: "ord-1",
      amount_cents: 5000,
      hold_days: 14,
    });
    const insertCall = captured.calls.find((c) => c.method === "insert");
    const payload = (insertCall!.args as unknown[])[0] as Record<string, unknown>;
    const heldMs = new Date(payload.held_until as string).getTime();
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    expect(heldMs - Date.now()).toBeGreaterThan(fourteenDays - 10_000);
  });

  it("returns null and skips insert when an order_completion row already exists (de-dupe)", async () => {
    const captured = mkAdmin({
      platform_reserve: { data: { id: "rsv_existing" } },
    });
    const result = await queueOrderReserve(captured.admin, {
      vendor_id: "v-1",
      order_id: "ord-1",
      amount_cents: 5000,
    });
    expect(result).toBeNull();
    const insertCall = captured.calls.find((c) => c.method === "insert");
    expect(insertCall).toBeUndefined();
  });

  it("returns null on zero amount (no-op for free orders / 100% fee)", async () => {
    const captured = mkAdmin({ platform_reserve: { data: null } });
    const result = await queueOrderReserve(captured.admin, {
      vendor_id: "v-1",
      order_id: "ord-1",
      amount_cents: 0,
    });
    expect(result).toBeNull();
  });

  it("throws on missing vendor_id or order_id", async () => {
    const { admin } = mkAdmin({});
    await expect(
      queueOrderReserve(admin, { vendor_id: "", order_id: "ord-1", amount_cents: 100 }),
    ).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
// resolveDestinationAccount
// ─────────────────────────────────────────────────────────────

describe("resolveDestinationAccount", () => {
  it("returns the stripe_account_id when vendor has fully-enabled Connect", async () => {
    const { admin } = mkAdmin({
      vendors: { data: { owner_user_id: "user-1" } },
      vendor_connect_accounts: {
        data: { stripe_account_id: "acct_1", charges_enabled: true, payouts_enabled: true },
      },
    });
    const result = await resolveDestinationAccount(admin, "vendor-1");
    expect(result).toBe("acct_1");
  });

  it("returns null when charges_enabled is false (KYC incomplete)", async () => {
    const { admin } = mkAdmin({
      vendors: { data: { owner_user_id: "user-1" } },
      vendor_connect_accounts: {
        data: { stripe_account_id: "acct_1", charges_enabled: false, payouts_enabled: true },
      },
    });
    const result = await resolveDestinationAccount(admin, "vendor-1");
    expect(result).toBeNull();
  });

  it("returns null when payouts_enabled is false", async () => {
    const { admin } = mkAdmin({
      vendors: { data: { owner_user_id: "user-1" } },
      vendor_connect_accounts: {
        data: { stripe_account_id: "acct_1", charges_enabled: true, payouts_enabled: false },
      },
    });
    const result = await resolveDestinationAccount(admin, "vendor-1");
    expect(result).toBeNull();
  });

  it("returns null when no Connect account exists", async () => {
    const { admin } = mkAdmin({
      vendors: { data: { owner_user_id: "user-1" } },
      vendor_connect_accounts: { data: null },
    });
    const result = await resolveDestinationAccount(admin, "vendor-1");
    expect(result).toBeNull();
  });

  it("returns null when vendor row doesn't exist", async () => {
    const { admin } = mkAdmin({ vendors: { data: null } });
    const result = await resolveDestinationAccount(admin, "vendor-missing");
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// markReserveReleased
// ─────────────────────────────────────────────────────────────

describe("markReserveReleased", () => {
  it("stamps released_at + released_to_stripe_transfer_id", async () => {
    const captured = mkAdmin({ platform_reserve: {} });
    await markReserveReleased(captured.admin, "rsv-1", "tr_xyz");
    const updateCall = captured.calls.find((c) => c.method === "update");
    expect(updateCall).toBeTruthy();
    const payload = (updateCall!.args as unknown[])[0] as Record<string, unknown>;
    expect(typeof payload.released_at).toBe("string");
    expect(payload.released_to_stripe_transfer_id).toBe("tr_xyz");
  });

  it("throws on DB error so caller can record outcome", async () => {
    const captured = mkAdmin({
      platform_reserve: { error: { message: "db is unreachable" } },
    });
    await expect(markReserveReleased(captured.admin, "rsv-1", "tr_xyz")).rejects.toThrow(/db is unreachable/);
  });
});

// ─────────────────────────────────────────────────────────────
// findDueReserves
// ─────────────────────────────────────────────────────────────

describe("findDueReserves", () => {
  it("returns the data array from the query", async () => {
    const rows = [
      { id: "r1", vendor_id: "v1", order_id: "o1", amount_cents: 100, held_until: "2026-05-01T00:00:00Z" },
    ];
    const { admin } = mkAdmin({ platform_reserve: { data: rows } });
    const result = await findDueReserves(admin);
    expect(result).toEqual(rows);
  });

  it("returns [] when no rows due", async () => {
    const { admin } = mkAdmin({ platform_reserve: { data: [] } });
    const result = await findDueReserves(admin);
    expect(result).toEqual([]);
  });

  it("throws on DB error", async () => {
    const { admin } = mkAdmin({
      platform_reserve: { error: { message: "query exploded" } },
    });
    await expect(findDueReserves(admin)).rejects.toThrow(/query exploded/);
  });
});
