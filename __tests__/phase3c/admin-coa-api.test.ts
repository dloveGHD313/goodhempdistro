/**
 * Phase 3C: Admin COA API and approval enforcement (mocked Supabase + requireAdminUsers).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockMaybeSingle = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockUpdate = vi.fn();
const mockSingle = vi.fn();
const mockCreateSignedUrl = vi.fn();

const fromChain = (table: string) => ({
  select: (cols: string) => {
    mockSelect(table, cols);
    return {
      eq: (col: string, val: unknown) => {
        mockEq(col, val);
        return {
          eq: (col2: string, val2: unknown) => {
            mockEq(col2, val2);
            return { maybeSingle: mockMaybeSingle, single: mockSingle };
          },
          maybeSingle: mockMaybeSingle,
          single: mockSingle,
        };
      },
    };
  },
  update: (data: unknown) => {
    mockUpdate(table, data);
    return {
      eq: (col: string, val: unknown) => ({
        eq: (col2: string, val2: unknown) => ({
          select: () => ({ maybeSingle: mockMaybeSingle, single: mockSingle }),
        }),
      }),
    };
  },
});

let adminMock = false;
vi.mock("@/lib/auth/requireAdminUsers", () => ({
  requireAdminUsers: vi.fn(() =>
    Promise.resolve({
      user: adminMock ? { id: "admin-1" } : null,
      isAdmin: adminMock,
    })
  ),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: (table: string) => fromChain(table),
    storage: {
      from: () => ({
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  })),
}));

describe("Phase 3C: Admin COA API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMock = true;
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  describe("GET /api/admin/products/[id]/coa", () => {
    it("returns 401 when not authenticated", async () => {
      adminMock = false;
      const { GET } = await import("@/app/api/admin/products/[id]/coa/route");
      const res = await GET({} as NextRequest, { params: Promise.resolve({ id: "prod-1" }) });
      expect(res.status).toBe(401);
    });

    it("returns 403 when authenticated but not admin", async () => {
      const { requireAdminUsers } = await import("@/lib/auth/requireAdminUsers");
      vi.mocked(requireAdminUsers).mockResolvedValueOnce({ user: { id: "u1" }, isAdmin: false });
      const { GET } = await import("@/app/api/admin/products/[id]/coa/route");
      const res = await GET({} as NextRequest, { params: Promise.resolve({ id: "prod-1" }) });
      expect(res.status).toBe(403);
    });

    it("returns document and coaRequired when admin", async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({ data: { id: "prod-1", category_id: "cat-1" }, error: null })
        .mockResolvedValueOnce({ data: { slug: "edibles", name: "Edibles" }, error: null })
        .mockResolvedValueOnce({
          data: {
            id: "doc-1",
            storage_path: "vendors/u1/products/p1/coa/file.pdf",
            status: "pending",
            admin_note: null,
            created_at: "2025-01-01T00:00:00Z",
          },
          error: null,
        });
      const { GET } = await import("@/app/api/admin/products/[id]/coa/route");
      const res = await GET({} as NextRequest, { params: Promise.resolve({ id: "prod-1" }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.document).toMatchObject({ status: "pending", id: "doc-1" });
      expect(body.coaRequired).toBe(true);
    });
  });

  describe("GET /api/admin/products/[id]/coa/view", () => {
    it("returns 403 when not admin", async () => {
      const { requireAdminUsers } = await import("@/lib/auth/requireAdminUsers");
      vi.mocked(requireAdminUsers).mockResolvedValueOnce({ user: { id: "u1" }, isAdmin: false });
      const { GET } = await import("@/app/api/admin/products/[id]/coa/view/route");
      const res = await GET({} as NextRequest, { params: Promise.resolve({ id: "prod-1" }) });
      expect(res.status).toBe(403);
    });

    it("returns signed url when admin and document exists", async () => {
      mockMaybeSingle.mockResolvedValueOnce({
        data: { storage_path: "vendors/u1/products/p1/coa/file.pdf", storage_bucket: "coas" },
        error: null,
      });
      mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.example/coa" }, error: null });
      const { GET } = await import("@/app/api/admin/products/[id]/coa/view/route");
      const res = await GET({} as NextRequest, { params: Promise.resolve({ id: "prod-1" }) });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.url).toBe("https://signed.example/coa");
    });
  });

  describe("PATCH /api/admin/products/[id]/coa/status", () => {
    it("returns 403 when not admin", async () => {
      const { requireAdminUsers } = await import("@/lib/auth/requireAdminUsers");
      vi.mocked(requireAdminUsers).mockResolvedValueOnce({ user: { id: "u1" }, isAdmin: false });
      const { PATCH } = await import("@/app/api/admin/products/[id]/coa/status/route");
      const res = await PATCH(
        new Request("http://x", { method: "PATCH", body: JSON.stringify({ status: "verified" }) }) as NextRequest,
        { params: Promise.resolve({ id: "prod-1" }) }
      );
      expect(res.status).toBe(403);
    });

    it("accepts status verified", async () => {
      mockMaybeSingle.mockResolvedValueOnce({
        data: { id: "doc-1", status: "verified", admin_note: null },
        error: null,
      });
      const { PATCH } = await import("@/app/api/admin/products/[id]/coa/status/route");
      const res = await PATCH(
        new Request("http://x", { method: "PATCH", body: JSON.stringify({ status: "verified" }) }) as NextRequest,
        { params: Promise.resolve({ id: "prod-1" }) }
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.document.status).toBe("verified");
    });

    it("accepts status rejected with admin_note", async () => {
      mockMaybeSingle.mockResolvedValueOnce({
        data: { id: "doc-1", status: "rejected", admin_note: "Incomplete panel" },
        error: null,
      });
      const { PATCH } = await import("@/app/api/admin/products/[id]/coa/status/route");
      const res = await PATCH(
        new Request("http://x", {
          method: "PATCH",
          body: JSON.stringify({ status: "rejected", admin_note: "Incomplete panel" }),
        }) as NextRequest,
        { params: Promise.resolve({ id: "prod-1" }) }
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.document.status).toBe("rejected");
      expect(body.document.admin_note).toBe("Incomplete panel");
    });
  });
});
