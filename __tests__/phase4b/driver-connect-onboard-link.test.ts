import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetSession = vi.fn();
const mockMaybeSingle = vi.fn();
const mockRequireApprovedDriver = vi.fn();
const mockAccountLinkCreate = vi.fn();

vi.mock("@/lib/env/stripeEnv", () => ({
  assertStripeLiveConfig: vi.fn(),
}));

vi.mock("@/lib/server/driverStatusGate", () => ({
  requireApprovedDriver: (...args: unknown[]) => mockRequireApprovedDriver(...args),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    accountLinks: {
      create: (...args: unknown[]) => mockAccountLinkCreate(...args),
    },
  },
  getSiteUrl: vi.fn(() => "https://example.com"),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getSession: mockGetSession },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mockMaybeSingle }),
      }),
    }),
  })),
}));

import { POST } from "@/app/api/driver/connect/onboard-link/route";

describe("driver connect onboard-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 409 when no connect account exists", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    mockRequireApprovedDriver.mockResolvedValue({ allowed: true, driverId: "d1" });
    mockMaybeSingle.mockResolvedValue({ data: { stripe_account_id: null } });

    const req = new NextRequest("http://localhost/api/driver/connect/onboard-link", { method: "POST" });
    const res = await POST(req);

    expect(res.status).toBe(409);
  });

  it("returns onboarding url when account exists", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    mockRequireApprovedDriver.mockResolvedValue({ allowed: true, driverId: "d1" });
    mockMaybeSingle.mockResolvedValue({ data: { stripe_account_id: "acct_123" } });
    mockAccountLinkCreate.mockResolvedValue({ url: "https://stripe.test/onboard" });

    const req = new NextRequest("http://localhost/api/driver/connect/onboard-link", { method: "POST" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.url).toContain("stripe.test/onboard");
  });
});
