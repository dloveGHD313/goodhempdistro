import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetSession = vi.fn();
const mockMaybeSingle = vi.fn();
const mockUpdateEq = vi.fn();
const mockStripeCreate = vi.fn();
const mockRequireApprovedDriver = vi.fn();

vi.mock("@/lib/env/stripeEnv", () => ({
  assertStripeLiveConfig: vi.fn(),
}));

vi.mock("@/lib/server/driverStatusGate", () => ({
  requireApprovedDriver: (...args: unknown[]) => mockRequireApprovedDriver(...args),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    accounts: {
      create: (...args: unknown[]) => mockStripeCreate(...args),
    },
  },
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getSession: mockGetSession },
    from: (table: string) => {
      if (table === "drivers") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: mockMaybeSingle }),
          }),
          update: () => ({
            eq: mockUpdateEq,
          }),
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: vi.fn() }) }),
      };
    },
  })),
}));

import { POST } from "@/app/api/driver/connect/create-account/route";

describe("driver connect create-account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateEq.mockResolvedValue({ error: null });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const req = new NextRequest("http://localhost/api/driver/connect/create-account", { method: "POST" });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when driver is not approved", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u1", email: "u@example.com" } } } });
    mockRequireApprovedDriver.mockResolvedValue({ allowed: false, status: 403, json: { error: "Approved driver account required." } });

    const req = new NextRequest("http://localhost/api/driver/connect/create-account", { method: "POST" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.ok).toBe(false);
  });

  it("returns existing account id without creating duplicate", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u1", email: "u@example.com" } } } });
    mockRequireApprovedDriver.mockResolvedValue({ allowed: true, driverId: "d1" });
    mockMaybeSingle.mockResolvedValue({ data: { stripe_account_id: "acct_existing" } });

    const req = new NextRequest("http://localhost/api/driver/connect/create-account", { method: "POST" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.already_exists).toBe(true);
    expect(body.stripe_account_id).toBe("acct_existing");
    expect(mockStripeCreate).not.toHaveBeenCalled();
  });
});
