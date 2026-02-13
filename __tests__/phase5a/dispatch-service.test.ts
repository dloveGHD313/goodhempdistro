import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

vi.mock("@/lib/stripe", () => ({
  getSiteUrl: vi.fn(() => "https://goodhempdistro.com"),
}));

import { createOfferToken, dispatchDeliveryOffers, hashOfferToken } from "@/lib/server/dispatchService";

describe("dispatchService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })));
  });

  it("stores only token hash and creates offers", async () => {
    const deliveryUpdates: Array<Record<string, unknown>> = [];
    const upserts: Array<Record<string, unknown>> = [];

    mockFrom.mockImplementation((table: string) => {
      if (table === "deliveries") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: "del_1",
                  status: "pending",
                  driver_id: null,
                  pickup_name: "A",
                  pickup_address: "1 st",
                  dropoff_name: "B",
                  dropoff_address: "2 st",
                  pickup_lat: 30,
                  pickup_lng: -97,
                  payout_cents: 1200,
                  offering_started_at: null,
                  offer_batch: 0,
                },
                error: null,
              })),
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: () => ({
              is: vi.fn(async () => {
                deliveryUpdates.push(payload);
                return { error: null };
              }),
            }),
          }),
        };
      }
      if (table === "drivers") {
        return {
          select: () => ({
            eq: vi.fn(async () => ({
              data: [
                {
                  id: "drv_1",
                  full_name: "Driver One",
                  email: "driver@example.com",
                  status: "approved",
                  driver_presence: [
                    {
                      is_online: true,
                      notify_offline: true,
                      lat: 30,
                      lng: -97,
                      location_updated_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                  ],
                },
              ],
              error: null,
            })),
          }),
        };
      }
      if (table === "delivery_offers") {
        return {
          upsert: vi.fn(async (payload: Record<string, unknown>) => {
            upserts.push(payload);
            return { error: null };
          }),
        };
      }
      return {};
    });

    const result = await dispatchDeliveryOffers("del_1");

    expect(result.ok).toBe(true);
    expect(result.offered).toBe(1);
    expect(deliveryUpdates[0].status).toBe("offering");
    expect(typeof upserts[0].accept_token_hash).toBe("string");
    expect(String(upserts[0].accept_token_hash).length).toBeGreaterThan(20);
  });

  it("hashes offer token deterministically", () => {
    const { token, tokenHash } = createOfferToken();
    expect(token).toBeTruthy();
    expect(hashOfferToken(token)).toBe(tokenHash);
  });
});
