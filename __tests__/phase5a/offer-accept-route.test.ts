import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

vi.mock("@/lib/server/dispatchService", () => ({
  hashOfferToken: vi.fn((token: string) => `hash:${token}`),
}));

import { GET } from "@/app/api/deliveries/offers/accept/route";

describe("offer accept route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assigns delivery and cancels other offers", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "drivers") {
        return { select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: { id: "drv_1", status: "approved" } })) }) }) };
      }
      if (table === "delivery_offers") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn(async () => ({
                  data: { id: "off_1", delivery_id: "del_1", driver_id: "drv_1", status: "offered", expires_at: new Date(Date.now() + 50000).toISOString(), accept_token_hash: "hash:token1" },
                })),
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: () => ({
                neq: () => ({ eq: vi.fn(async () => ({ error: null })) }),
              }),
              neq: () => ({ eq: vi.fn(async () => ({ error: null })) }),
            }),
          }),
        };
      }
      if (table === "deliveries") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: { id: "del_1", driver_id: null, status: "offering" } })) }) }),
          update: () => ({
            eq: () => ({
              is: () => ({ in: () => ({ select: () => ({ maybeSingle: vi.fn(async () => ({ data: { id: "del_1" } })) }) }) }),
            }),
          }),
        };
      }
      return {};
    });

    const req = new NextRequest("https://example.com/api/deliveries/offers/accept?deliveryId=del_1&driverId=drv_1&token=token1");
    const res = await GET(req);
    expect(res.status).toBe(307);
  });

  it("returns taken redirect when already assigned", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "drivers") {
        return { select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: { id: "drv_1", status: "approved" } })) }) }) };
      }
      if (table === "delivery_offers") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn(async () => ({
                  data: { id: "off_1", delivery_id: "del_1", driver_id: "drv_1", status: "offered", expires_at: new Date(Date.now() + 50000).toISOString(), accept_token_hash: "hash:token1" },
                })),
              }),
            }),
          }),
          update: () => ({ eq: () => ({ eq: vi.fn(async () => ({ error: null })) }) }),
        };
      }
      if (table === "deliveries") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: { id: "del_1", driver_id: "drv_2", status: "assigned" } })) }) }),
        };
      }
      return {};
    });

    const req = new NextRequest("https://example.com/api/deliveries/offers/accept?deliveryId=del_1&driverId=drv_1&token=token1");
    const res = await GET(req);
    expect(res.headers.get("location")).toContain("offer=taken");
  });
});
