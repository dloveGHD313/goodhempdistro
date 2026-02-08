import { describe, it, expect } from "vitest";
import { getPostLoginRoute } from "@/lib/routing/postLoginRoute";

describe("getPostLoginRoute", () => {
  it("returns /onboarding for null profile", () => {
    expect(getPostLoginRoute(null)).toBe("/onboarding");
  });

  it("returns /onboarding when onboarding_completed_at is null/undefined", () => {
    expect(
      getPostLoginRoute({
        role: "consumer",
        onboarding_completed_at: null,
        consumer_onboarding_completed: true,
      })
    ).toBe("/onboarding");
    expect(
      getPostLoginRoute({
        role: "consumer",
        consumer_onboarding_completed: true,
      })
    ).toBe("/onboarding");
  });

  it("returns /onboarding when consumer_onboarding_completed is false/undefined", () => {
    expect(
      getPostLoginRoute({
        role: "consumer",
        onboarding_completed_at: "2025-01-01T00:00:00Z",
        consumer_onboarding_completed: false,
      })
    ).toBe("/onboarding");
    expect(
      getPostLoginRoute({
        role: "consumer",
        onboarding_completed_at: "2025-01-01T00:00:00Z",
      })
    ).toBe("/onboarding");
  });

  it("returns /dashboard when onboarding complete (phase15 + consumer)", () => {
    expect(
      getPostLoginRoute({
        role: "consumer",
        onboarding_completed_at: "2025-01-01T00:00:00Z",
        consumer_onboarding_completed: true,
      })
    ).toBe("/dashboard");
  });

  it("returns /dashboard for admin role even without onboarding fields", () => {
    expect(
      getPostLoginRoute({
        role: "admin",
        onboarding_completed_at: null,
        consumer_onboarding_completed: false,
      })
    ).toBe("/dashboard");
  });
});
