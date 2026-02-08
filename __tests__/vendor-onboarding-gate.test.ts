import { describe, expect, it, vi, beforeEach } from "vitest";
import { requireVendorOnboarding } from "@/lib/server/onboardingGate";

const mockProfileData = vi.fn();
const mockVendorData = vi.fn();

vi.mock("@/lib/supabase", () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      from: (table: string) => ({
        select: (cols: string) => ({
          eq: (_col: string, val: unknown) => ({
            maybeSingle: () =>
              table === "profiles" ? mockProfileData(val) : mockVendorData(val),
          }),
        }),
      }),
    })
  ),
}));

describe("requireVendorOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileData.mockResolvedValue({ data: null, error: null });
    mockVendorData.mockResolvedValue({ data: null, error: null });
  });

  it("redirects to login when userId is null", async () => {
    const result = await requireVendorOnboarding(null);
    expect(result).toEqual({ redirectTo: "/login" });
    expect(mockProfileData).not.toHaveBeenCalled();
  });

  it("redirects to /vendors/activate when vendor_status is pending and has vendor record", async () => {
    mockProfileData.mockResolvedValue({
      data: { id: "u1", role: "consumer", vendor_status: "pending" },
      error: null,
    });
    mockVendorData.mockResolvedValue({
      data: { id: "v1", owner_user_id: "u1", vendor_onboarding_completed: true, terms_accepted_at: "2024-01-01", compliance_acknowledged_at: "2024-01-01" },
      error: null,
    });
    const result = await requireVendorOnboarding("u1");
    expect(result).toEqual({ redirectTo: "/vendors/activate" });
  });

  it("redirects to /vendor-registration when vendor_status is null", async () => {
    mockProfileData.mockResolvedValue({
      data: { id: "u1", role: "consumer", vendor_status: null },
      error: null,
    });
    mockVendorData.mockResolvedValue({ data: null, error: null });
    const result = await requireVendorOnboarding("u1");
    expect(result).toEqual({ redirectTo: "/vendor-registration" });
  });

  it("returns allow:true when vendor_status is active and onboarding complete", async () => {
    mockProfileData.mockResolvedValue({
      data: { id: "u1", role: "vendor", vendor_status: "active" },
      error: null,
    });
    mockVendorData.mockResolvedValue({
      data: { id: "v1", owner_user_id: "u1", vendor_onboarding_completed: true, terms_accepted_at: "2024-01-01", compliance_acknowledged_at: "2024-01-01" },
      error: null,
    });
    const result = await requireVendorOnboarding("u1");
    expect(result).toEqual({ allow: true });
  });

  it("returns allow:true for admin regardless of vendor_status", async () => {
    mockProfileData.mockResolvedValue({
      data: { id: "u1", role: "admin", vendor_status: null },
      error: null,
    });
    const result = await requireVendorOnboarding("u1");
    expect(result).toEqual({ allow: true });
    expect(mockVendorData).not.toHaveBeenCalled();
  });
});
