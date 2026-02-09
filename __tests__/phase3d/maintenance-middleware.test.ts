import { describe, expect, it, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const mockGetSession = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _key: string) => ({
    auth: {
      getSession: mockGetSession,
    },
  })),
}));

describe("Phase 3D: maintenance middleware", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.MAINTENANCE_MODE = "1";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon_key";
    process.env.ADMIN_EMAILS = "admin@example.com";
  });

  it("allows /maintenance during maintenance mode", async () => {
    const req = new NextRequest("http://localhost/maintenance");
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects non-admin page requests to /maintenance", async () => {
    const req = new NextRequest("http://localhost/");
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/maintenance");
  });

  it("allows /api/health during maintenance mode", async () => {
    const req = new NextRequest("http://localhost/api/health");
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it("returns 503 JSON for non-admin API routes during maintenance", async () => {
    const req = new NextRequest("http://localhost/api/vendors/products/create");
    const res = await middleware(req);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: false,
      error: "maintenance",
      message: "Service temporarily unavailable",
    });
  });

  it("redirects non-admin /admin page to /maintenance", async () => {
    // No session returned => not admin
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const req = new NextRequest("http://localhost/admin");
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/maintenance");
  });

  it("allows admin access to /admin and /api/admin/* during maintenance", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { email: "admin@example.com" } } },
    });

    const adminPageReq = new NextRequest("http://localhost/admin");
    const adminPageRes = await middleware(adminPageReq);
    expect(adminPageRes.status).toBe(200);

    const adminApiReq = new NextRequest("http://localhost/api/admin/diag/env");
    const adminApiRes = await middleware(adminApiReq);
    expect(adminApiRes.status).toBe(200);
  });
});

