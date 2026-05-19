import { describe, it, expect } from "vitest";
import { queueOrderReserve, findDueReserves, markReserveReleased } from "@/lib/server/platformReserve";
import { logConnectEvent, extendReserveForDispute } from "@/lib/server/stripeConnectEvents";
import { getConnectFeeForCheckout } from "@/lib/billing/connectFees";
import { getTierFromPlanKey } from "@/lib/billing/tier-mapping";
import { COMMISSION_RATES } from "@/lib/referral";

/**
 * Phase 4 / Build #3 PR-F — integration-style tests that exercise the
 * full funds-flow loop end-to-end using a chainable Supabase mock.
 *
 * These tests prove the integration contracts WITHIN the codebase. They
 * intentionally do NOT touch the live Stripe API — the smoke checklist
 * in .claude/audit/STRIPE-CONNECT-TEST-MODE-SMOKE.md is the human-driven
 * complement that exercises real Stripe test mode end-to-end.
 */

const VENDOR_ID = "v-test-pr-f";
const OWNER_USER_ID = "u-test-pr-f";
const STRIPE_ACCT = "acct_test_pr_f";
const PRODUCT_SUBTOTAL_CENTS = 10000; // $100

type ReserveRow = {
  id: string;
  vendor_id: string;
  order_id: string | null;
  amount_cents: number;
  reason: string;
  held_until: string;
  released_at: string | null;
  released_to_stripe_transfer_id: string | null;
  notes?: string | null;
};

type ConnectAccountRow = {
  user_id: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
};

type VendorRow = { id: string; tier: string | null; owner_user_id: string };

type State = {
  reserves: ReserveRow[];
  vendors: Record<string, VendorRow>;
  connectAccounts: Record<string, ConnectAccountRow>;
  connectEvents: Record<string, { event_id: string; event_type: string }>;
  pkSeq: number;
};

/**
 * Build a Supabase admin mock that supports both read chains
 * (`from().select().eq().is().lte().gt().order().limit()` awaited or
 * `.maybeSingle()`-ed) and write chains
 * (`from().insert()` / `from().update(...).eq().in()` awaited).
 *
 * All operations record their effect against the shared `state` so
 * tests can assert across multiple chained calls.
 */
function makeAdmin(state: State) {
  function from(table: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filters: any = {};
    let mode: "read" | "insert" | "update" = "read";
    let updatePayload: Record<string, unknown> = {};
    let insertPayload: Record<string, unknown> | Record<string, unknown>[] = {};

    const applyFilter = (row: Record<string, unknown>): boolean => {
      for (const [col, condition] of Object.entries(filters)) {
        if (condition && typeof condition === "object" && !Array.isArray(condition)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const c = condition as any;
          if (c.__is !== undefined && row[col] !== c.__is) return false;
          if (c.__in !== undefined && !c.__in.includes(row[col])) return false;
          if (c.__lte !== undefined) {
            if (typeof row[col] === "string" && new Date(row[col] as string) > new Date(c.__lte)) return false;
          }
          if (c.__gt !== undefined) {
            if ((row[col] as number) <= c.__gt) return false;
          }
        } else if (row[col] !== condition) {
          return false;
        }
      }
      return true;
    };

    const executeRead = (single: boolean) => {
      if (table === "platform_reserve") {
        const matching = state.reserves.filter(applyFilter as (r: ReserveRow) => boolean);
        return { data: single ? matching[0] ?? null : matching, error: null };
      }
      if (table === "vendors") {
        const matching = Object.values(state.vendors).filter(applyFilter as (r: VendorRow) => boolean);
        return { data: single ? matching[0] ?? null : matching, error: null };
      }
      if (table === "vendor_connect_accounts") {
        const matching = Object.values(state.connectAccounts).filter(applyFilter as (r: ConnectAccountRow) => boolean);
        return { data: single ? matching[0] ?? null : matching, error: null };
      }
      return { data: single ? null : [], error: null };
    };

    const executeWrite = () => {
      if (mode === "insert") {
        if (table === "platform_reserve") {
          const p = insertPayload as Record<string, unknown>;
          const newRow: ReserveRow = {
            id: `rsv-${++state.pkSeq}`,
            vendor_id: String(p.vendor_id),
            order_id: p.order_id ? String(p.order_id) : null,
            amount_cents: Number(p.amount_cents),
            reason: String(p.reason),
            held_until: String(p.held_until),
            released_at: null,
            released_to_stripe_transfer_id: null,
            notes: p.notes ? String(p.notes) : null,
          };
          state.reserves.push(newRow);
          return { data: newRow, error: null };
        }
        if (table === "stripe_connect_events") {
          const p = insertPayload as Record<string, unknown>;
          const event_id = String(p.event_id);
          if (state.connectEvents[event_id]) {
            return { data: null, error: { code: "23505", message: "duplicate key" } };
          }
          state.connectEvents[event_id] = { event_id, event_type: String(p.event_type) };
          return { data: null, error: null };
        }
        return { data: null, error: null };
      }
      if (mode === "update") {
        if (table === "platform_reserve") {
          for (const row of state.reserves) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (!applyFilter(row as any)) continue;
            for (const [k, v] of Object.entries(updatePayload)) {
              if (v !== undefined && v !== null) (row as Record<string, unknown>)[k] = v;
            }
          }
          return { data: null, error: null };
        }
        if (table === "vendor_connect_accounts") {
          // Not used in this integration test; accept silently.
          return { data: null, error: null };
        }
        return { data: null, error: null };
      }
      return { data: null, error: null };
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {
      select() {
        // mode stays as read or insert (insert.select chain returns inserted row)
        return builder;
      },
      eq(col: string, val: unknown) {
        filters[col] = val;
        return builder;
      },
      in(col: string, vals: unknown[]) {
        filters[col] = { __in: vals };
        return builder;
      },
      is(col: string, val: unknown) {
        filters[col] = { __is: val };
        return builder;
      },
      lte(col: string, val: unknown) {
        filters[col] = { ...(filters[col] || {}), __lte: val };
        return builder;
      },
      gt(col: string, val: unknown) {
        filters[col] = { ...(filters[col] || {}), __gt: val };
        return builder;
      },
      order() { return builder; },
      limit() { return builder; },
      insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
        mode = "insert";
        insertPayload = payload;
        return builder;
      },
      update(payload: Record<string, unknown>) {
        mode = "update";
        updatePayload = payload;
        return builder;
      },
      async maybeSingle() {
        if (mode === "insert") return executeWrite();
        return executeRead(true);
      },
      then(resolve: (v: unknown) => void) {
        // Direct-await of the chain (used by writes, and by reads that don't
        // call .maybeSingle()).
        if (mode === "read") resolve(executeRead(false));
        else resolve(executeWrite());
      },
    };
    return builder;
  }

  return { from };
}

function freshState(): State {
  return {
    reserves: [],
    vendors: {
      [VENDOR_ID]: { id: VENDOR_ID, tier: "mid", owner_user_id: OWNER_USER_ID },
    },
    connectAccounts: {
      [STRIPE_ACCT]: {
        user_id: OWNER_USER_ID,
        stripe_account_id: STRIPE_ACCT,
        charges_enabled: true,
        payouts_enabled: true,
      },
    },
    connectEvents: {},
    pkSeq: 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("Phase 4 integration: fee → reserve → release", () => {
  it("step 1: getConnectFeeForCheckout returns 500 bps fee for tier=mid", async () => {
    const admin = makeAdmin(freshState());
    const fee = await getConnectFeeForCheckout(admin, {
      vendorId: VENDOR_ID,
      vendorOwnerUserId: OWNER_USER_ID,
      productSubtotalCents: PRODUCT_SUBTOTAL_CENTS,
    });
    expect(fee).not.toBeNull();
    expect(fee!.feeBps).toBe(COMMISSION_RATES.mid);
    expect(fee!.applicationFeeAmount).toBe(500);
    expect(fee!.destination).toBe(STRIPE_ACCT);
  });

  it("step 2: queueOrderReserve writes a 7-day hold for vendor net", async () => {
    const state = freshState();
    const admin = makeAdmin(state);
    const vendorNet = PRODUCT_SUBTOTAL_CENTS - 500;
    const result = await queueOrderReserve(admin, {
      vendor_id: VENDOR_ID,
      order_id: "ord-1",
      amount_cents: vendorNet,
    });
    expect(result).not.toBeNull();
    expect(state.reserves.length).toBe(1);
    expect(state.reserves[0]!.amount_cents).toBe(9500);
    expect(state.reserves[0]!.reason).toBe("order_completion");
    const heldDelta = new Date(state.reserves[0]!.held_until).getTime() - Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(heldDelta).toBeGreaterThan(sevenDays - 10_000);
    expect(heldDelta).toBeLessThan(sevenDays + 10_000);
  });

  it("step 3+4: findDueReserves picks up an expired row + markReserveReleased stamps it", async () => {
    const state = freshState();
    const admin = makeAdmin(state);
    state.reserves.push({
      id: "rsv-due-1",
      vendor_id: VENDOR_ID,
      order_id: "ord-1",
      amount_cents: 9500,
      reason: "order_completion",
      held_until: new Date(Date.now() - 1000).toISOString(),
      released_at: null,
      released_to_stripe_transfer_id: null,
    });

    const due = await findDueReserves(admin);
    expect(due.length).toBe(1);
    expect(due[0]!.id).toBe("rsv-due-1");

    await markReserveReleased(admin, "rsv-due-1", "tr_mock_xyz");
    expect(state.reserves[0]!.released_at).not.toBeNull();
    expect(state.reserves[0]!.released_to_stripe_transfer_id).toBe("tr_mock_xyz");

    const dueAfter = await findDueReserves(admin);
    expect(dueAfter.length).toBe(0);
  });
});

describe("Phase 4 integration: idempotency safeguards", () => {
  it("queueOrderReserve dedupes when webhook fires twice for same order", async () => {
    const state = freshState();
    const admin = makeAdmin(state);

    const first = await queueOrderReserve(admin, {
      vendor_id: VENDOR_ID,
      order_id: "ord-replay",
      amount_cents: 9500,
    });
    expect(first).not.toBeNull();
    expect(state.reserves.length).toBe(1);

    const second = await queueOrderReserve(admin, {
      vendor_id: VENDOR_ID,
      order_id: "ord-replay",
      amount_cents: 9500,
    });
    expect(second).toBeNull();
    expect(state.reserves.length).toBe(1);
  });

  it("logConnectEvent dedupes a duplicate Stripe event_id (23505)", async () => {
    const state = freshState();
    const admin = makeAdmin(state);

    const first = await logConnectEvent(admin, {
      event_id: "evt_test_dup_flow",
      event_type: "account.updated",
      vendor_id: VENDOR_ID,
      stripe_account_id: STRIPE_ACCT,
      payload: { id: "evt_test_dup_flow" },
    });
    expect(first).toEqual({ firstSeen: true });

    const replay = await logConnectEvent(admin, {
      event_id: "evt_test_dup_flow",
      event_type: "account.updated",
      vendor_id: VENDOR_ID,
      stripe_account_id: STRIPE_ACCT,
      payload: { id: "evt_test_dup_flow" },
    });
    expect(replay).toEqual({ firstSeen: false });
  });
});

describe("Phase 4 integration: dispute extends hold", () => {
  it("charge.dispute.created extends held_until on the affected order by +30d", async () => {
    const state = freshState();
    const admin = makeAdmin(state);
    state.reserves.push({
      id: "rsv-dispute-1",
      vendor_id: VENDOR_ID,
      order_id: "ord-dispute-1",
      amount_cents: 9500,
      reason: "order_completion",
      held_until: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      released_at: null,
      released_to_stripe_transfer_id: null,
    });
    const beforeMs = new Date(state.reserves[0]!.held_until).getTime();
    const extended = await extendReserveForDispute(admin, {
      order_id: "ord-dispute-1",
      dispute_id: "dp_test_1",
    });
    expect(extended).toBe(1);
    const afterMs = new Date(state.reserves[0]!.held_until).getTime();
    expect(afterMs).toBeGreaterThan(beforeMs);
    expect(afterMs - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(state.reserves[0]!.reason).toBe("dispute_extension");
  });

  it("dispute on an order with no reserve is a no-op (returns 0)", async () => {
    const state = freshState();
    const admin = makeAdmin(state);
    const extended = await extendReserveForDispute(admin, {
      order_id: "ord-missing",
      dispute_id: "dp_test_2",
    });
    expect(extended).toBe(0);
  });
});

describe("Phase 4 integration: fee table sanity", () => {
  it("tier→bps mapping aligns with COMMISSION_RATES in lib/referral.ts", () => {
    expect(getTierFromPlanKey("vendor_starter_monthly")).toBe("starter");
    expect(getTierFromPlanKey("vendor_pro_annual")).toBe("mid");
    expect(getTierFromPlanKey("vendor_enterprise_monthly")).toBe("top");
    expect(COMMISSION_RATES.starter).toBe(700);
    expect(COMMISSION_RATES.mid).toBe(500);
    expect(COMMISSION_RATES.top).toBe(100);
  });
});
