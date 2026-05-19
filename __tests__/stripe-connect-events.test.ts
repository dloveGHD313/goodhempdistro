import { describe, it, expect, vi } from "vitest";
import {
  extendReserveForDispute,
  logConnectEvent,
  lookupVendorByAccountId,
  markConnectEventProcessed,
  syncConnectAccountStatus,
} from "@/lib/server/stripeConnectEvents";

/**
 * PR-C tests pin the contract for the Connect webhook helper module.
 * Signature verification is tested by Stripe's library; not retested here.
 * Each helper is exercised with a fake Supabase admin that records calls.
 */

type Captured = { table: string; method: string; args: unknown };

function mkAdmin(handlers: {
  // table → method-name → response (data + error)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [table: string]: { data?: any; error?: any; throwsOnInsert?: { code?: string; message?: string } };
}) {
  const calls: Captured[] = [];
  const makeChain = (table: string): unknown => {
    const data = handlers[table]?.data ?? null;
    const error = handlers[table]?.error ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      select: vi.fn((...args: unknown[]) => {
        calls.push({ table, method: "select", args });
        return chain;
      }),
      insert: vi.fn(async (...args: unknown[]) => {
        calls.push({ table, method: "insert", args });
        const t = handlers[table]?.throwsOnInsert;
        if (t) return { data: null, error: { code: t.code, message: t.message } };
        return { data, error };
      }),
      update: vi.fn((...args: unknown[]) => {
        calls.push({ table, method: "update", args });
        return chain;
      }),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      is: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => ({ data, error })),
      then: undefined,
    };
    // Make .update().eq().in() resolve like a thenable when awaited.
    // Vitest awaits the return value of update().in(...) — we model it as
    // a chain that's also a promise.
    chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
    return chain;
  };
  return {
    calls,
    admin: { from: (table: string) => makeChain(table) },
  };
}

// ───────────────────────────────────────────────────────────────────
// lookupVendorByAccountId
// ───────────────────────────────────────────────────────────────────

describe("lookupVendorByAccountId", () => {
  it("returns null when no Connect row exists", async () => {
    const { admin } = mkAdmin({ vendor_connect_accounts: { data: null } });
    const result = await lookupVendorByAccountId(admin, "acct_unknown");
    expect(result).toBeNull();
  });

  it("returns null when stripe_account_id is empty", async () => {
    const { admin } = mkAdmin({});
    const result = await lookupVendorByAccountId(admin, "");
    expect(result).toBeNull();
  });

  it("returns vendor + user when the join chain resolves", async () => {
    // Build a per-table chain so vendors lookup returns the vendor row.
    const chain = {
      vendor_connect_accounts: { data: { user_id: "user-1" } },
      vendors: { data: { id: "vendor-1" } },
    };
    const { admin } = mkAdmin(chain);
    const result = await lookupVendorByAccountId(admin, "acct_1");
    expect(result).toEqual({ vendor_id: "vendor-1", user_id: "user-1" });
  });
});

// ───────────────────────────────────────────────────────────────────
// logConnectEvent — idempotency
// ───────────────────────────────────────────────────────────────────

describe("logConnectEvent", () => {
  it("returns firstSeen=true on a fresh insert", async () => {
    const { admin } = mkAdmin({ stripe_connect_events: {} });
    const result = await logConnectEvent(admin, {
      event_id: "evt_test_1",
      event_type: "account.updated",
      vendor_id: "v-1",
      stripe_account_id: "acct_1",
      payload: { id: "evt_test_1" },
    });
    expect(result).toEqual({ firstSeen: true });
  });

  it("returns firstSeen=false on PK conflict (Stripe retry / duplicate)", async () => {
    const { admin } = mkAdmin({
      stripe_connect_events: {
        throwsOnInsert: { code: "23505", message: "duplicate key value violates unique constraint" },
      },
    });
    const result = await logConnectEvent(admin, {
      event_id: "evt_test_dup",
      event_type: "transfer.created",
      vendor_id: null,
      stripe_account_id: "acct_1",
      payload: {},
    });
    expect(result).toEqual({ firstSeen: false });
  });

  it("throws on non-23505 errors (real failures bubble up)", async () => {
    const { admin } = mkAdmin({
      stripe_connect_events: {
        throwsOnInsert: { code: "08006", message: "connection failure" },
      },
    });
    await expect(
      logConnectEvent(admin, {
        event_id: "evt_x",
        event_type: "payout.failed",
        vendor_id: null,
        stripe_account_id: null,
        payload: {},
      }),
    ).rejects.toThrow(/insert failed/i);
  });
});

// ───────────────────────────────────────────────────────────────────
// markConnectEventProcessed
// ───────────────────────────────────────────────────────────────────

describe("markConnectEventProcessed", () => {
  it("updates the row with outcome + processed_at + error message", async () => {
    const captured = mkAdmin({ stripe_connect_events: {} });
    await markConnectEventProcessed(captured.admin, "evt_1", "ok");
    const updateCall = captured.calls.find((c) => c.table === "stripe_connect_events" && c.method === "update");
    expect(updateCall).toBeTruthy();
    const payload = (updateCall!.args as unknown[])[0] as Record<string, unknown>;
    expect(payload.processed_outcome).toBe("ok");
    expect(typeof payload.processed_at).toBe("string");
    expect(payload.error_message).toBeNull();
  });

  it("records error message when outcome=error", async () => {
    const captured = mkAdmin({ stripe_connect_events: {} });
    await markConnectEventProcessed(captured.admin, "evt_2", "error", "transfer rejected by Stripe");
    const updateCall = captured.calls.find((c) => c.table === "stripe_connect_events" && c.method === "update");
    const payload = (updateCall!.args as unknown[])[0] as Record<string, unknown>;
    expect(payload.processed_outcome).toBe("error");
    expect(payload.error_message).toBe("transfer rejected by Stripe");
  });
});

// ───────────────────────────────────────────────────────────────────
// syncConnectAccountStatus
// ───────────────────────────────────────────────────────────────────

describe("syncConnectAccountStatus", () => {
  it("writes charges_enabled + payouts_enabled + payout_schedule_preference", async () => {
    const captured = mkAdmin({ vendor_connect_accounts: {} });
    await syncConnectAccountStatus(captured.admin, "acct_1", {
      charges_enabled: true,
      payouts_enabled: true,
      settings: { payouts: { schedule: { interval: "weekly" } } },
    });
    const updateCall = captured.calls.find((c) => c.table === "vendor_connect_accounts" && c.method === "update");
    expect(updateCall).toBeTruthy();
    const payload = (updateCall!.args as unknown[])[0] as Record<string, unknown>;
    expect(payload.charges_enabled).toBe(true);
    expect(payload.payouts_enabled).toBe(true);
    expect(payload.payout_schedule_preference).toBe("weekly");
  });

  it("only writes the fields present on the account (no overwriting with undefined)", async () => {
    const captured = mkAdmin({ vendor_connect_accounts: {} });
    await syncConnectAccountStatus(captured.admin, "acct_1", { payouts_enabled: false });
    const updateCall = captured.calls.find((c) => c.table === "vendor_connect_accounts" && c.method === "update");
    const payload = (updateCall!.args as unknown[])[0] as Record<string, unknown>;
    expect("charges_enabled" in payload).toBe(false);
    expect(payload.payouts_enabled).toBe(false);
    expect("payout_schedule_preference" in payload).toBe(false);
  });

  it("ignores invalid payout interval values", async () => {
    const captured = mkAdmin({ vendor_connect_accounts: {} });
    await syncConnectAccountStatus(captured.admin, "acct_1", {
      settings: { payouts: { schedule: { interval: "biweekly" } } },
    });
    const updateCall = captured.calls.find((c) => c.table === "vendor_connect_accounts" && c.method === "update");
    const payload = (updateCall!.args as unknown[])[0] as Record<string, unknown>;
    expect("payout_schedule_preference" in payload).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────
// extendReserveForDispute
// ───────────────────────────────────────────────────────────────────

describe("extendReserveForDispute", () => {
  it("returns 0 when order_id is null", async () => {
    const { admin } = mkAdmin({});
    const result = await extendReserveForDispute(admin, { order_id: null, dispute_id: "dp_1" });
    expect(result).toBe(0);
  });

  it("returns 0 when no matching reserve rows exist", async () => {
    const { admin } = mkAdmin({ platform_reserve: { data: [] } });
    const result = await extendReserveForDispute(admin, { order_id: "ord_1", dispute_id: "dp_1" });
    expect(result).toBe(0);
  });

  it("extends rows whose held_until is sooner than now+30d", async () => {
    const soon = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days from now
    const { admin } = mkAdmin({
      platform_reserve: {
        data: [
          { id: "r1", held_until: soon },
          { id: "r2", held_until: soon },
        ],
      },
    });
    const result = await extendReserveForDispute(admin, { order_id: "ord_1", dispute_id: "dp_1" });
    expect(result).toBe(2);
  });

  it("skips rows whose held_until is already past now+30d (no-op)", async () => {
    const farFuture = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days
    const { admin } = mkAdmin({
      platform_reserve: { data: [{ id: "r1", held_until: farFuture }] },
    });
    const result = await extendReserveForDispute(admin, { order_id: "ord_1", dispute_id: "dp_1" });
    expect(result).toBe(0);
  });
});
