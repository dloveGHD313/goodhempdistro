import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTransfersCreate = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    transfers: {
      create: (...args: unknown[]) => mockTransfersCreate(...args),
    },
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

import { releaseDriverPayoutForDelivery } from "@/lib/server/driverPayoutService";

function makeDeliveriesTable(state: {
  delivery: Record<string, unknown> | null;
  updateCalls: Array<Record<string, unknown>>;
}) {
  return {
    select: (cols: string) => ({
      eq: () => ({
        maybeSingle: vi.fn(async () => ({ data: cols.includes("delivery_type") ? state.delivery : null, error: null })),
      }),
    }),
    update: (payload: Record<string, unknown>) => ({
      eq: vi.fn(async () => {
        state.updateCalls.push(payload);
        return { error: null };
      }),
    }),
  };
}

describe("driver payout service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns alreadyPaid when delivery payout_status is paid", async () => {
    const state = {
      delivery: {
        id: "del_1",
        driver_id: "drv_1",
        payout_cents: 1200,
        driver_payout_cents: 0,
        payout_status: "paid",
        confirmed_at: "2024-01-01T00:00:00.000Z",
        delivery_type: "retail",
        proof_photo_url: "https://proof",
        receiver_name: null,
      },
      updateCalls: [] as Array<Record<string, unknown>>,
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "deliveries") return makeDeliveriesTable(state);
      if (table === "driver_payouts") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: null })) }) }),
          insert: vi.fn(async () => ({ error: null })),
        };
      }
      if (table === "drivers") {
        return { select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: null })) }) }) };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: null })) }) }) };
    });

    const result = await releaseDriverPayoutForDelivery({ deliveryId: "del_1" });

    expect(result.ok).toBe(true);
    expect(result.alreadyPaid).toBe(true);
    expect(mockTransfersCreate).not.toHaveBeenCalled();
  });

  it("marks delivery as failed when stripe transfer fails", async () => {
    const state = {
      delivery: {
        id: "del_2",
        driver_id: "drv_2",
        payout_cents: 1500,
        driver_payout_cents: 0,
        payout_status: "eligible",
        confirmed_at: "2024-01-01T00:00:00.000Z",
        delivery_type: "retail",
        proof_photo_url: "https://proof",
        receiver_name: null,
      },
      updateCalls: [] as Array<Record<string, unknown>>,
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "deliveries") return makeDeliveriesTable(state);
      if (table === "driver_payouts") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: null })) }) }),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null })) })),
          })),
        };
      }
      if (table === "drivers") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: vi.fn(async () => ({ data: { id: "drv_2", stripe_account_id: "acct_123" } })) }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: null })) }) }) };
    });

    mockTransfersCreate.mockRejectedValue({ message: "Stripe transfer failed" });

    const result = await releaseDriverPayoutForDelivery({ deliveryId: "del_2", userId: "user_2" });

    expect(result.ok).toBe(false);
    expect(state.updateCalls.some((payload) => payload.payout_status === "failed")).toBe(true);
    expect(state.updateCalls.some((payload) => typeof payload.payout_error === "string")).toBe(true);
  });
});
