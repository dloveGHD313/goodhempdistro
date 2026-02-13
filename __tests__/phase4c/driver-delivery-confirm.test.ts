import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetSession = vi.fn();
const mockDeliveryMaybeSingle = vi.fn();
const mockUpdateMaybeSingle = vi.fn();
const mockRequireApprovedDriver = vi.fn();
const mockReleaseDriverPayout = vi.fn();

vi.mock("@/lib/server/driverStatusGate", () => ({
  requireApprovedDriver: (...args: unknown[]) => mockRequireApprovedDriver(...args),
}));

vi.mock("@/lib/server/driverPayoutService", () => ({
  computeDriverPayoutCents: vi.fn((row: { payout_cents?: number; driver_payout_cents?: number }) =>
    row.driver_payout_cents && row.driver_payout_cents > 0 ? row.driver_payout_cents : row.payout_cents ?? 0
  ),
  isDeliveryProofVerifiable: vi.fn((deliveryType: string, proofPhotoUrl: string, receiverName: string) => {
    if (!proofPhotoUrl?.trim()) return false;
    if (deliveryType === "b2b") return Boolean(receiverName?.trim());
    return true;
  }),
  releaseDriverPayoutForDelivery: (...args: unknown[]) => mockReleaseDriverPayout(...args),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getSession: mockGetSession },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: mockDeliveryMaybeSingle }),
        }),
      }),
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: () => ({ maybeSingle: mockUpdateMaybeSingle }),
          }),
        }),
      }),
    }),
  })),
}));

import { POST } from "@/app/api/driver/deliveries/[deliveryId]/confirm/route";

describe("driver delivery confirm route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const req = new NextRequest("http://localhost/api/driver/deliveries/del_1/confirm", { method: "POST", body: "{}" });

    const res = await POST(req, { params: Promise.resolve({ deliveryId: "del_1" }) });

    expect(res.status).toBe(401);
  });

  it("returns 403 when driver is not approved", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    mockRequireApprovedDriver.mockResolvedValue({ allowed: false, status: 403, json: { error: "Approved driver account required." } });

    const req = new NextRequest("http://localhost/api/driver/deliveries/del_1/confirm", { method: "POST", body: "{}" });
    const res = await POST(req, { params: Promise.resolve({ deliveryId: "del_1" }) });

    expect(res.status).toBe(403);
  });

  it("retail missing proof returns unpaid and not confirmed", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    mockRequireApprovedDriver.mockResolvedValue({ allowed: true, driverId: "d1" });
    mockDeliveryMaybeSingle.mockResolvedValue({
      data: {
        id: "del_1",
        driver_id: "d1",
        delivery_type: "retail",
        payout_cents: 900,
        driver_payout_cents: 0,
        payout_status: "unpaid",
        delivered_at: null,
        confirmed_at: null,
        proof_photo_url: null,
        receiver_name: null,
      },
    });
    mockUpdateMaybeSingle.mockResolvedValue({ data: { id: "del_1", payout_status: "unpaid" } });

    const req = new NextRequest("http://localhost/api/driver/deliveries/del_1/confirm", {
      method: "POST",
      body: JSON.stringify({ delivery_type: "retail", proof_photo_url: "" }),
    });

    const res = await POST(req, { params: Promise.resolve({ deliveryId: "del_1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.confirmed).toBe(false);
    expect(body.payout_status).toBe("unpaid");
    expect(mockReleaseDriverPayout).not.toHaveBeenCalled();
  });

  it("retail with proof becomes eligible and pays", async () => {
    mockGetSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    mockRequireApprovedDriver.mockResolvedValue({ allowed: true, driverId: "d1" });
    mockDeliveryMaybeSingle.mockResolvedValue({
      data: {
        id: "del_2",
        driver_id: "d1",
        delivery_type: "retail",
        payout_cents: 1500,
        driver_payout_cents: 0,
        payout_status: "unpaid",
        delivered_at: null,
        confirmed_at: null,
        proof_photo_url: null,
        receiver_name: null,
      },
    });
    mockUpdateMaybeSingle.mockResolvedValue({ data: { id: "del_2", payout_status: "eligible" } });
    mockReleaseDriverPayout.mockResolvedValue({ ok: true, requestId: "r1", stripeTransferId: "tr_123" });

    const req = new NextRequest("http://localhost/api/driver/deliveries/del_2/confirm", {
      method: "POST",
      body: JSON.stringify({ delivery_type: "retail", proof_photo_url: "https://proof" }),
    });

    const res = await POST(req, { params: Promise.resolve({ deliveryId: "del_2" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.confirmed).toBe(true);
    expect(body.payout_status).toBe("paid");
    expect(body.stripe_transfer_id).toBe("tr_123");
    expect(mockReleaseDriverPayout).toHaveBeenCalledTimes(1);
  });
});
