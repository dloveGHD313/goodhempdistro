import { describe, expect, it } from "vitest";
import { getPublicRedirectForStartPath } from "@/lib/phase2-workout-flow";

const GATED_ROUTES = [
  "/vendor-registration",
  "/affiliate",
  "/logistics/apply",
  "/dashboard",
  "/onboarding",
  "/vendors/dashboard",
  "/account",
];

describe("getPublicRedirectForStartPath", () => {
  it("never returns known gated routes for any Start path", () => {
    const paths = ["events", "education", "shopper", "vendor", "logistics", "builder", "affiliate", "service_provider"];
    for (const path of paths) {
      const redirect = getPublicRedirectForStartPath(path);
      expect(GATED_ROUTES, `getPublicRedirectForStartPath("${path}") returned ${redirect}`).not.toContain(redirect);
    }
  });

  it("returns /events for events", () => {
    expect(getPublicRedirectForStartPath("events")).toBe("/events");
  });

  it("returns /education for education", () => {
    expect(getPublicRedirectForStartPath("education")).toBe("/education");
  });

  it("returns /discover for vendor, shopper, logistics, builder, affiliate, service_provider", () => {
    expect(getPublicRedirectForStartPath("vendor")).toBe("/discover");
    expect(getPublicRedirectForStartPath("shopper")).toBe("/discover");
    expect(getPublicRedirectForStartPath("logistics")).toBe("/discover");
    expect(getPublicRedirectForStartPath("builder")).toBe("/discover");
    expect(getPublicRedirectForStartPath("affiliate")).toBe("/discover");
    expect(getPublicRedirectForStartPath("service_provider")).toBe("/discover");
  });

  it("returns /discover for unknown or null path", () => {
    expect(getPublicRedirectForStartPath(null)).toBe("/discover");
    expect(getPublicRedirectForStartPath(undefined)).toBe("/discover");
    expect(getPublicRedirectForStartPath("")).toBe("/discover");
    expect(getPublicRedirectForStartPath("other")).toBe("/discover");
  });
});
