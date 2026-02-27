/**
 * Phase 3C: Product approval fails when COA required but not verified; succeeds when verified.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();

let adminMock = true;
vi.mock("@/lib/auth/requireAdmin", () => ({
  requireAdmin: vi.fn(() =>
    Promise.resolve({
      user: adminMock ? { id: "admin-1", email: "admin@test.com" } : null,
      isAdmin: adminMock,
      reason: "allowlist_email",
      profile: { id: "admin-1", role: "admin", is_admin: true },
    })
  ),
}));

const productSelect = { id: "p1", name: "Prod", status: "pending_review", category_id: "cat-1" };
const categorySelect = { slug: "edibles", name: "Edibles" };
let coaDocStatus: string = "pending";

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({
      from: (table: string) => ({
        select: (cols: string) => ({
          eq: (col: string, val: unknown) => ({
            eq: (col2: string, val2: unknown) => ({
              maybeSingle: () => {
                if (table === "product_documents") return Promise.resolve({ data: { status: coaDocStatus }, error: null });
                return Promise.resolve({ data: null, error: null });
              },
            }),
            maybeSingle: () => {
              if (table === "products") return Promise.resolve({ data: productSelect, error: null });
              if (table === "categories") return Promise.resolve({ data: categorySelect, error: null });
              return Promise.resolve({ data: null, error: null });
            },
            single: () => Promise.resolve(mockSingle()),
          }),
        }),
        update: () => ({
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: "p1", name: "Prod", status: "approved" }, error: null }),
            }),
          }),
        }),
      }),
    })),
}));

vi.mock("@/lib/adminActionLog", () => ({
  writeAdminActionLog: vi.fn(() => Promise.resolve()),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Phase 3C: Approve COA enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMock = true;
  });

  it("approval fails with 409 when COA required but document not verified", async () => {
    coaDocStatus = "pending";
    const { POST } = await import("@/app/api/admin/products/[id]/approve/route");
    const res = await POST({} as NextRequest, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("COA must be verified");
  });

  it("approval succeeds when COA verified", async () => {
    coaDocStatus = "verified";
    const { POST } = await import("@/app/api/admin/products/[id]/approve/route");
    const res = await POST({} as NextRequest, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
