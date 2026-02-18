/**
 * Phase 3C: Guest checkout for event tickets — API validation and public behavior.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: () => mockGetUser(),
      },
    })
  ),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "ev-1", title: "Test Event", capacity: 100, tickets_sold: 0, status: "published" },
        error: null,
      }),
      in: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "order-1" }, error: null }),
        }),
      }),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    })),
  })),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: "cs_test_1",
          url: "https://checkout.stripe.com/test",
        }),
      },
    },
  },
  getSiteUrl: vi.fn(() => "https://example.com"),
}));

describe("Phase 3C: Event guest checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when age_confirmed_21 is missing (guest)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { POST } = await import("@/app/api/events/checkout/route");
    const req = new Request("http://localhost/api/events/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "ev-1",
        tickets: [{ ticket_type_id: "tt-1", quantity: 1 }],
        purchaser_email: "guest@example.com",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("21");
  });

  it("returns 400 when guest omits purchaser_email", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { POST } = await import("@/app/api/events/checkout/route");
    const req = new Request("http://localhost/api/events/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_id: "ev-1",
        tickets: [{ ticket_type_id: "tt-1", quantity: 1 }],
        age_confirmed_21: true,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("purchaser_email");
  });

  it("returns 400 when event_id and tickets are missing", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { POST } = await import("@/app/api/events/checkout/route");
    const req = new Request("http://localhost/api/events/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
