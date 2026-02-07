import { describe, expect, it, vi, beforeEach } from "vitest";
import { getVendorStatus, requireVendorActive } from "@/lib/server/vendorStatusGate";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      from: (table: string) => ({
        select: (cols: string) => {
          mockSelect(table, cols);
          return { eq: (col: string, val: unknown) => {
            mockEq(col, val);
            return { maybeSingle: mockMaybeSingle };
          } };
        },
      }),
    })
  ),
}));

vi.mock("@/lib/admin", () => ({
  isAdminEmail: vi.fn((email: string | null | undefined) =>
    email === "admin@example.com"
  ),
}));

import { getVendorStatus, requireVendorActive } from "@/lib/server/vendorStatusGate";

describe("vendor status gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  describe("getVendorStatus", () => {
    it("returns null when userId is null", async () => {
      const status = await getVendorStatus(null);
      expect(status).toBeNull();
      expect(mockMaybeSingle).not.toHaveBeenCalled();
    });

    it("returns active when profile.vendor_status is active", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { vendor_status: "active" },
        error: null,
      });
      const status = await getVendorStatus("user-123");
      expect(status).toBe("active");
    });

    it("returns pending when profile.vendor_status is pending", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { vendor_status: "pending" },
        error: null,
      });
      const status = await getVendorStatus("user-123");
      expect(status).toBe("pending");
    });

    it("returns null when profile.vendor_status is null", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { vendor_status: null },
        error: null,
      });
      const status = await getVendorStatus("user-123");
      expect(status).toBeNull();
    });
  });

  describe("requireVendorActive", () => {
    it("returns allowed:false with 403 when userId is null", async () => {
      const result = await requireVendorActive(null);
      expect(result).toEqual({
        allowed: false,
        status: 403,
        json: { error: "Unauthorized" },
      });
    });

    it("returns allowed:true for admin email", async () => {
      const result = await requireVendorActive("user-123", "admin@example.com");
      expect(result).toEqual({ allowed: true });
      expect(mockMaybeSingle).not.toHaveBeenCalled();
    });

    it("returns allowed:false with vendor subscription message when vendor_status is pending", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { vendor_status: "pending" },
        error: null,
      });
      const result = await requireVendorActive("user-123", "vendor@example.com");
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(403);
      expect((result as { json?: { error?: string } }).json?.error).toContain(
        "Vendor subscription required"
      );
    });

    it("returns allowed:false when vendor_status is null", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { vendor_status: null },
        error: null,
      });
      const result = await requireVendorActive("user-123", "vendor@example.com");
      expect(result.allowed).toBe(false);
    });

    it("returns allowed:true when vendor_status is active", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { vendor_status: "active" },
        error: null,
      });
      const result = await requireVendorActive("user-123", "vendor@example.com");
      expect(result).toEqual({ allowed: true });
    });
  });
});
