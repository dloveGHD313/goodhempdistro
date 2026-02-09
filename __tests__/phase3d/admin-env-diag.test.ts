import { describe, expect, it, beforeEach, vi } from "vitest";

const mockRequireAdminUsers = vi.fn();

vi.mock("@/lib/auth/requireAdminUsers", () => ({
  requireAdminUsers: (req: unknown) => mockRequireAdminUsers(req),
}));

vi.mock("@/lib/server/maintenance", () => ({
  isMaintenanceModeEnabled: () => true,
}));

describe("Phase 3D: admin env diagnostics API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("blocks unauthenticated users", async () => {
    mockRequireAdminUsers.mockResolvedValue({ user: null, isAdmin: false });
    const { GET } = await import("@/app/api/admin/diag/env/route");
    const res = await GET({} as any);
    expect([401, 403]).toContain(res.status);
  });

  it("blocks non-admin users", async () => {
    mockRequireAdminUsers.mockResolvedValue({ user: { id: "user-1" }, isAdmin: false });
    const { GET } = await import("@/app/api/admin/diag/env/route");
    const res = await GET({} as any);
    expect(res.status).toBe(403);
  });

  it("returns maintenanceMode and requiredEnv only for admins", async () => {
    mockRequireAdminUsers.mockResolvedValue({ user: { id: "admin-1" }, isAdmin: true });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "role";
    process.env.STRIPE_SECRET_KEY = "sk_test";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec";
    process.env.NEXT_PUBLIC_SITE_URL = "https://site.example.com";

    const { GET } = await import("@/app/api/admin/diag/env/route");
    const res = await GET({} as any);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(typeof body.maintenanceMode).toBe("boolean");
    expect(typeof body.requiredEnv).toBe("object");

    const keys = Object.keys(body.requiredEnv).sort();
    expect(keys).toEqual([
      "NEXT_PUBLIC_SITE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "SUPABASE_SERVICE_ROLE_KEY",
    ].sort());

    // Ensure no unexpected fields leak
    expect(body.chosenKeyName).toBeUndefined();
    expect(body.chosenKeyValueLength).toBeUndefined();
    expect(body.consumerPlans).toBeUndefined();
  });
});

