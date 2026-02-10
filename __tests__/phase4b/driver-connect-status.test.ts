import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetSession = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpdateEq = vi.fn();
const mockRequireApprovedDriver = vi.fn();
const mockAccountRetrieve = vi.fn();

vi.mock("@/lib/server/driverStatusGate", () => ({
  requireApprovedDriver: (...args: unknown[]) => mockRequireApprovedDriver(...args),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    accounts: {
      retrieve: (...args: unknown[]) => mockAccountRetrieve(...args),
    },
  },
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getSession: mockGetSession },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mockMaybeSingle }),
      }),
      update: () => ({ eq: mockUpdateEq }),
    }),
  })),
}));

import { GET } from "@/app/api/driver/connect/status/route";

describe("driver connect status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateEq.mockResolvedValue({ error: null });
  });

  it("returns connected false when no stripe account exists", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    mockRequireApprovedDriver.mockResolvedValue({ allowed: true, driverId: "d1" });
    mockMaybeSingle.mockResolvedValue({ data: { stripe_account_id: null, charges_enabled: false, payouts_enabled: false } });

    const req = new NextRequest("http://localhost/api/driver/connect/status");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.connected).toBe(false);
    expect(body.payout_ready).toBe(false);
  });

  it("returns payout_ready true when stripe flags are all true", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    mockRequireApprovedDriver.mockResolvedValue({ allowed: true, driverId: "d1" });
    mockMaybeSingle.mockResolvedValue({ data: { stripe_account_id: "acct_1", charges_enabled: false, payouts_enabled: false } });
    mockAccountRetrieve.mockResolvedValue({ details_submitted: true, charges_enabled: true, payouts_enabled: true });

    const req = new NextRequest("http://localhost/api/driver/connect/status");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.connected).toBe(true);
    expect(body.payout_ready).toBe(true);
  });
});
