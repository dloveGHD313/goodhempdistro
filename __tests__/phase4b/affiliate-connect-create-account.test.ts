import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetSession = vi.fn();
const mockAffiliateMaybeSingle = vi.fn();
const mockProfilesMaybeSingle = vi.fn();
const mockProfilesUpdateEq = vi.fn();
const mockAffiliatesUpdateEq = vi.fn();
const mockStripeCreate = vi.fn();

vi.mock("@/lib/env/stripeEnv", () => ({
  assertStripeLiveConfig: vi.fn(),
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
      if (table === "affiliates") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: mockAffiliateMaybeSingle }),
          }),
          update: () => ({ eq: mockAffiliatesUpdateEq }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: mockProfilesMaybeSingle }),
          }),
          update: () => ({ eq: mockProfilesUpdateEq }),
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: vi.fn() }) }),
      };
    },
  })),
}));

import { POST } from "@/app/api/affiliates/connect/create-account/route";

describe("affiliate connect create-account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfilesUpdateEq.mockResolvedValue({ error: null });
    mockAffiliatesUpdateEq.mockResolvedValue({ error: null });
  });

  it("returns 401 when no session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const res = await POST(new NextRequest("http://localhost/api/affiliates/connect/create-account", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("creates stripe account and persists to profiles", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u1", email: "u@example.com" } } } });
    mockAffiliateMaybeSingle.mockResolvedValue({ data: { id: "a1" } });
    mockProfilesMaybeSingle.mockResolvedValue({ data: { stripe_account_id: null } });
    mockStripeCreate.mockResolvedValue({ id: "acct_new" });

    const res = await POST(new NextRequest("http://localhost/api/affiliates/connect/create-account", { method: "POST" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stripeAccountId).toBe("acct_new");
    expect(mockProfilesUpdateEq).toHaveBeenCalled();
  });
});
