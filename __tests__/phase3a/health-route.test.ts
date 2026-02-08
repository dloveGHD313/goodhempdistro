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

  it("returns 200 and JSON with ok, db, storage, stripe", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: expect.any(Boolean),
      db: expect.stringMatching(/^(ok|fail)$/),
      storage: expect.stringMatching(/^(ok|fail)$/),
      stripe: expect.stringMatching(/^(ok|missing)$/),
    });
  });

  it("returns db ok when admin client select succeeds", async () => {
    mockMaybeSingle.mockResolvedValue({ error: null });
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    const body = await res.json();
    expect(body.db).toBe("ok");
  });

  it("returns storage ok when bucket list succeeds", async () => {
    mockList.mockResolvedValue({ error: null });
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    const body = await res.json();
    expect(body.storage).toBe("ok");
  });
});
