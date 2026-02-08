/**
 * Phase 3A: Vendor gating consistency (unit-level).
 * Ensures gating helper returns expected statuses for active / pending / disabled (null).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { getVendorStatus, requireVendorActive } from "@/lib/server/vendorStatusGate";

const mockMaybeSingle = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: mockMaybeSingle }),
        }),
      }),
    })
  ),
}));

vi.mock("@/lib/admin", () => ({
  isAdminEmail: vi.fn((email: string | null | undefined) => email === "admin@example.com"),
}));

describe("Phase 3A: vendor gating consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("getVendorStatus returns active when profile.vendor_status is active", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { vendor_status: "active" }, error: null });
    const status = await getVendorStatus("user-1");
    expect(status).toBe("active");
  });

  it("getVendorStatus returns pending when profile.vendor_status is pending", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { vendor_status: "pending" }, error: null });
    const status = await getVendorStatus("user-1");
    expect(status).toBe("pending");
  });

  it("getVendorStatus returns null when profile.vendor_status is null (disabled/unset)", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { vendor_status: null }, error: null });
    const status = await getVendorStatus("user-1");
    expect(status).toBeNull();
  });

  it("requireVendorActive returns allowed:true for active", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { vendor_status: "active" }, error: null });
    const result = await requireVendorActive("user-1", "v@example.com");
    expect(result).toEqual({ allowed: true });
  });

  it("requireVendorActive returns allowed:false with 403 for pending", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { vendor_status: "pending" }, error: null });
    const result = await requireVendorActive("user-1", "v@example.com");
    expect(result).toMatchObject({ allowed: false, status: 403 });
    expect((result as { json?: { error?: string } }).json?.error).toContain("subscription");
  });

  it("requireVendorActive returns allowed:true for admin email without DB check", async () => {
    const result = await requireVendorActive("user-1", "admin@example.com");
    expect(result).toEqual({ allowed: true });
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });
});
