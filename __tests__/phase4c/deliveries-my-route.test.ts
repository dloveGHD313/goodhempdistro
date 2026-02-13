import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockVendorMaybeSingle = vi.fn();
const mockDriverMaybeSingle = vi.fn();
const mockVendorOrder = vi.fn();
const mockDriverOrder = vi.fn();

let deliveriesSelectArg = "";

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table === "vendors") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: mockVendorMaybeSingle }),
          }),
        };
      }

      if (table === "drivers") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: mockDriverMaybeSingle }),
          }),
        };
      }

      if (table === "deliveries") {
        return {
          select: (cols: string) => {
            deliveriesSelectArg = cols;
            return {
              eq: (_col: string, value: string) => ({
                order: value === "vendor_1" ? mockVendorOrder : mockDriverOrder,
              }),
            };
          },
        };
      }

      return {
        select: () => ({ eq: () => ({ maybeSingle: vi.fn() }) }),
      };
    },
  })),
}));

import { GET } from "@/app/api/deliveries/my/route";

describe("GET /api/deliveries/my", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deliveriesSelectArg = "";
  });

  it("returns phase 4C delivery fields for drivers", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user_1" } } });
    mockVendorMaybeSingle.mockResolvedValue({ data: null });
    mockDriverMaybeSingle.mockResolvedValue({ data: { id: "driver_1" } });
    mockDriverOrder.mockResolvedValue({ data: [{ id: "delivery_1", payout_status: "unpaid" }] });

    const req = new NextRequest("http://localhost/api/deliveries/my");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deliveries).toHaveLength(1);
    expect(deliveriesSelectArg).toContain("payout_status");
    expect(deliveriesSelectArg).toContain("driver_stripe_transfer_id");
    expect(deliveriesSelectArg).toContain("delivered_at");
    expect(deliveriesSelectArg).toContain("confirmed_at");
    expect(deliveriesSelectArg).toContain("proof_photo_url");
    expect(deliveriesSelectArg).toContain("receiver_name");
    expect(deliveriesSelectArg).toContain("bol_reference");
    expect(deliveriesSelectArg).toContain("driver_payout_cents");
  });

  it("preserves vendor branch behavior", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user_2" } } });
    mockVendorMaybeSingle.mockResolvedValue({ data: { id: "vendor_1" } });
    mockDriverMaybeSingle.mockResolvedValue({ data: null });
    mockVendorOrder.mockResolvedValue({ data: [{ id: "delivery_vendor_1" }] });

    const req = new NextRequest("http://localhost/api/deliveries/my");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.deliveries).toEqual([{ id: "delivery_vendor_1" }]);
  });
});
