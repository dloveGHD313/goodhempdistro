/**
 * Phase 3A: Health route returns 200 and structured JSON (mocked clients).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockMaybeSingle = vi.fn().mockResolvedValue({ error: null });
const mockList = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabaseAdmin", () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        limit: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    }),
    storage: {
      from: () => ({
        list: mockList,
      }),
    },
  })),
}));

describe("Phase 3A: /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ error: null });
    mockList.mockResolvedValue({ error: null });
  });

  it("returns 200 and JSON with ok, db, storage, stripe when healthy", async () => {
    mockMaybeSingle.mockResolvedValue({ error: null });
    mockList.mockResolvedValue({ error: null });
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      db: "ok",
      storage: "ok",
      stripe: expect.stringMatching(/^(ok|missing)$/),
    });
  });

  it("returns 503 when unhealthy (db fail)", async () => {
    mockMaybeSingle.mockResolvedValue({ error: { message: "db error" } });
    mockList.mockResolvedValue({ error: null });
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.db).toBe("fail");
  });

  it("returns 503 when unhealthy (storage fail)", async () => {
    mockMaybeSingle.mockResolvedValue({ error: null });
    mockList.mockResolvedValue({ error: { message: "storage error" } });
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.storage).toBe("fail");
  });
});
