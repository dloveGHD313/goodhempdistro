import { describe, it, expect } from "vitest";
import {
  NAV_ITEMS,
  getCtaNav,
  getNavItemsForSurface,
  DEFAULT_NAV_CTX,
  vendorIsPaid,
  consumerShouldSeeUpgrade,
  type NavContext,
  type NavSurface,
} from "@/lib/nav";

// ---------------------------------------------------------------------------
// Phase 6 — CTA engine tests (exact spec from engineering brief)
// ---------------------------------------------------------------------------

const contexts: Record<string, NavContext> = {
  guest: {
    ...DEFAULT_NAV_CTX,
    isLoggedIn: false,
    role: "public",
    roles: [],
    vendorPlan: "unknown",
    consumerPlan: "unknown",
  },
  consumerNoPlan: {
    ...DEFAULT_NAV_CTX,
    isLoggedIn: true,
    role: "user",
    roles: ["user"],
    vendorPlan: "unknown",
    consumerPlan: "none",
  },
  vendorUnpaid: {
    ...DEFAULT_NAV_CTX,
    isLoggedIn: true,
    role: "vendor",
    roles: ["vendor"],
    vendorPlan: "none",
    consumerPlan: "unknown",
  },
  vendorPaid: {
    ...DEFAULT_NAV_CTX,
    isLoggedIn: true,
    role: "vendor",
    roles: ["vendor"],
    vendorPlan: "starter",
    consumerPlan: "unknown",
  },
  admin: {
    ...DEFAULT_NAV_CTX,
    isLoggedIn: true,
    role: "admin",
    roles: ["admin"],
    vendorPlan: "unknown",
    consumerPlan: "unknown",
  },
};

describe("getCtaNav", () => {
  it("guest sees cta-join-free and cta-sign-in", () => {
    const result = getCtaNav(contexts.guest);
    expect(result.map((i) => i.id)).toEqual(["cta-join-free", "cta-sign-in"]);
  });

  it("consumer (no plan) sees cta-upgrade-consumer", () => {
    const result = getCtaNav(contexts.consumerNoPlan);
    expect(result.map((i) => i.id)).toEqual(["cta-upgrade-consumer"]);
  });

  it("unpaid vendor sees cta-choose-vendor-plan", () => {
    const result = getCtaNav(contexts.vendorUnpaid);
    expect(result.map((i) => i.id)).toEqual(["cta-choose-vendor-plan"]);
  });

  it("paid vendor sees cta-add-product", () => {
    const result = getCtaNav(contexts.vendorPaid);
    expect(result.map((i) => i.id)).toEqual(["cta-add-product"]);
  });

  it("admin sees cta-admin-dashboard", () => {
    const result = getCtaNav(contexts.admin);
    expect(result.map((i) => i.id)).toEqual(["cta-admin-dashboard"]);
  });

  it("no context ever returns more than 2 CTAs", () => {
    for (const ctx of Object.values(contexts)) {
      expect(getCtaNav(ctx).length).toBeLessThanOrEqual(2);
    }
  });

  it("no context returns duplicate hrefs", () => {
    for (const ctx of Object.values(contexts)) {
      const hrefs = getCtaNav(ctx).map((i) => i.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
  });
});

// ---------------------------------------------------------------------------
// Derived helpers
// ---------------------------------------------------------------------------

describe("vendorIsPaid", () => {
  it("returns false when role is not vendor", () => {
    expect(vendorIsPaid({ ...DEFAULT_NAV_CTX, role: "user", vendorPlan: "starter" })).toBe(false);
  });
  it("returns false when vendorPlan is none", () => {
    expect(vendorIsPaid({ ...DEFAULT_NAV_CTX, role: "vendor", vendorPlan: "none" })).toBe(false);
  });
  it("returns false when vendorPlan is unknown", () => {
    expect(vendorIsPaid({ ...DEFAULT_NAV_CTX, role: "vendor", vendorPlan: "unknown" })).toBe(false);
  });
  it("returns true for vendor with starter plan", () => {
    expect(vendorIsPaid({ ...DEFAULT_NAV_CTX, role: "vendor", vendorPlan: "starter" })).toBe(true);
  });
  it("returns true for vendor with mid plan", () => {
    expect(vendorIsPaid({ ...DEFAULT_NAV_CTX, role: "vendor", vendorPlan: "mid" })).toBe(true);
  });
});

describe("consumerShouldSeeUpgrade", () => {
  it("returns false when not a user role", () => {
    expect(consumerShouldSeeUpgrade({ ...DEFAULT_NAV_CTX, role: "vendor", consumerPlan: "none" })).toBe(false);
  });
  it("returns false when consumerPlan is unknown (suppress CTA)", () => {
    expect(consumerShouldSeeUpgrade({ ...DEFAULT_NAV_CTX, role: "user", consumerPlan: "unknown" })).toBe(false);
  });
  it("returns false when consumer already has a plan", () => {
    expect(consumerShouldSeeUpgrade({ ...DEFAULT_NAV_CTX, role: "user", consumerPlan: "basic" })).toBe(false);
  });
  it("returns true when consumer has no plan", () => {
    expect(consumerShouldSeeUpgrade({ ...DEFAULT_NAV_CTX, role: "user", consumerPlan: "none" })).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// NAV_ITEMS integrity
// ---------------------------------------------------------------------------

describe("NAV_ITEMS integrity", () => {
  it("every item has a non-empty id, label, href, and at least one surface", () => {
    for (const item of NAV_ITEMS) {
      expect(item.id, `item id`).toBeTruthy();
      expect(item.label, `item "${item.id}" label`).toBeTruthy();
      expect(item.href, `item "${item.id}" href`).toBeTruthy();
      expect(item.surfaces.length, `item "${item.id}" must have at least one surface`).toBeGreaterThan(0);
    }
  });

  it("all ids are unique across NAV_ITEMS", () => {
    const ids = NAV_ITEMS.map((i) => i.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("all CTA items have a `when` function", () => {
    const ctaItems = NAV_ITEMS.filter((i) => i.surfaces.includes("cta"));
    for (const item of ctaItems) {
      expect(typeof item.when, `cta item "${item.id}" must have a when function`).toBe("function");
    }
  });
});

// ---------------------------------------------------------------------------
// Non-CTA surfaces: no duplicate hrefs per surface per context
// ---------------------------------------------------------------------------

const NON_CTA_SURFACES: NavSurface[] = [
  "desktopPrimary",
  "moreMenu",
  "mobilePrimary",
  "mobileMore",
  "accountMenu",
  "adminMenu",
];

const SURFACE_CONTEXTS: { label: string; ctx: NavContext }[] = [
  { label: "guest", ctx: contexts.guest },
  { label: "consumerNoPlan", ctx: contexts.consumerNoPlan },
  { label: "vendorUnpaid", ctx: contexts.vendorUnpaid },
  { label: "vendorPaid", ctx: contexts.vendorPaid },
  { label: "admin", ctx: contexts.admin },
  {
    label: "wholesale buyer",
    ctx: {
      ...DEFAULT_NAV_CTX,
      isLoggedIn: true,
      role: "user",
      roles: ["wholesale"],
      hasWholesaleContext: true,
    },
  },
];

describe("getNavItemsForSurface — unique hrefs per surface per context", () => {
  for (const surface of NON_CTA_SURFACES) {
    for (const { label, ctx } of SURFACE_CONTEXTS) {
      it(`surface="${surface}" ctx="${label}" yields unique hrefs`, () => {
        const items = getNavItemsForSurface(surface, ctx);
        const hrefs = items.map((i) => i.href.toLowerCase().replace(/\/$/, ""));
        const unique = new Set(hrefs);
        expect(
          unique.size,
          `Duplicate hrefs on surface "${surface}" for "${label}": [${hrefs.join(", ")}]`
        ).toBe(hrefs.length);
      });
    }
  }
});
