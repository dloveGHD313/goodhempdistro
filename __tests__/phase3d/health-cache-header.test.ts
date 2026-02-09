import { describe, expect, it } from "vitest";

describe("Phase 3D: /api/health cache headers", () => {
  it("sets Cache-Control no-store and only exposes ok/db/storage", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["db", "ok", "storage"]);
    expect(body).not.toHaveProperty("stripe");
  });
});

