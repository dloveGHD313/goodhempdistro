import { describe, it, expect } from "vitest";
import {
  NAV_ITEMS,
  getNavItemsForSurface,
  type NavSurface,
  type NavContext,
} from "@/lib/nav";

// All surfaces to check for href uniqueness
const ALL_SURFACES: NavSurface[] = [
  "desktopPrimary",
  "moreMenu",
  "mobilePrimary",
  "mobileMore",
  "accountMenu",
  "adminMenu",
  "cta",
];

// Representative contexts to exercise visibility rules
const CONTEXTS: { label: string; ctx: NavContext }[] = [
  {
    label: "logged-out public",
    ctx: { isLoggedIn: false, roles: [] },
  },
  {
    label: "logged-in consumer",
    ctx: { isLoggedIn: true, roles: ["user"] },
  },
  {
    label: "logged-in vendor",
    ctx: { isLoggedIn: true, roles: ["vendor"] },
  },
  {
    label: "logged-in wholesale buyer",
    ctx: { isLoggedIn: true, roles: ["wholesale"], hasWholesaleContext: true },
  },
  {
    label: "logged-in admin",
    ctx: { isLoggedIn: true, roles: ["admin"] },
  },
];

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
});

describe("getNavItemsForSurface — no duplicate hrefs per surface per context", () => {
  for (const surface of ALL_SURFACES) {
    for (const { label, ctx } of CONTEXTS) {
      it(`surface="${surface}" ctx="${label}" yields unique hrefs`, () => {
        // In test env, getNavItemsForSurface throws on duplicates automatically.
        // This assertion also validates uniqueness explicitly.
        const items = getNavItemsForSurface(surface, ctx);
        const hrefs = items.map((i) => i.href.toLowerCase().replace(/\/$/, ""));
        const unique = new Set(hrefs);
        expect(
          unique.size,
          `Duplicate hrefs detected on surface "${surface}" for "${label}": [${hrefs.join(", ")}]`
        ).toBe(hrefs.length);
      });
    }
  }
});
