import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Regression contract for the vendor auth boundary — see GATE-02.
 *
 * Verifies two defense layers without spinning up a server:
 *   1. middleware.ts contains the RESERVED_VENDOR_SUBROUTES allowlist
 *      and uses it to mark /vendors/<reserved>* as a protected route.
 *   2. Each authed vendor layout/page declares
 *      `export const dynamic = "force-dynamic"` so its session check
 *      actually runs at request time (i.e. Next.js cannot statically
 *      pre-render the route and serve cached HTML to anonymous users).
 *
 * If you add a new authed subroute under /vendors/?
 *   - Add it to RESERVED_VENDOR_SUBROUTES in middleware.ts
 *   - Add `export const dynamic = "force-dynamic"` to its layout/page
 *   - Add it to AUTHED_ROUTES below
 * If you add a new PUBLIC subroute under /vendors/?
 *   - Add it to PUBLIC_VENDOR_ROUTES below
 *   - Make sure the path does NOT match a reserved subroute name
 */

const REPO_ROOT = path.resolve(__dirname, "..");

// Authed routes — middleware must gate these AND each must have force-dynamic.
// Each entry: {urlSegments after /vendors/, layout-or-page path relative to repo}
const AUTHED_ROUTES = [
  { sub: "billing", dynamicFile: "app/vendors/billing/layout.tsx" },
  { sub: "dashboard", dynamicFile: "app/vendors/dashboard/layout.tsx" },
  { sub: "orders", dynamicFile: "app/vendors/orders/layout.tsx" },
  { sub: "payouts", dynamicFile: "app/vendors/payouts/page.tsx" },
  { sub: "products", dynamicFile: "app/vendors/products/layout.tsx" },
  { sub: "services", dynamicFile: "app/vendors/services/layout.tsx" },
  { sub: "settings", dynamicFile: "app/vendors/settings/layout.tsx" },
  { sub: "referrals", dynamicFile: "app/vendors/referrals/layout.tsx" },
  { sub: "events", dynamicFile: "app/vendors/events/layout.tsx" },
];

// Public routes — middleware must NOT gate these. /vendors/[uuid] is implicit;
// covered by the reserved-words check returning false for non-reserved segments.
const PUBLIC_VENDOR_ROUTES = ["/vendors", "/vendors/activate"];

describe("Vendor auth boundary (GATE-02 regression contract)", () => {
  describe("Defense Layer 1 — middleware allowlist", () => {
    const middlewareSrc = fs.readFileSync(path.join(REPO_ROOT, "middleware.ts"), "utf8");

    it("declares the RESERVED_VENDOR_SUBROUTES set", () => {
      expect(middlewareSrc).toMatch(/RESERVED_VENDOR_SUBROUTES\s*=\s*new Set\(/);
    });

    for (const { sub } of AUTHED_ROUTES) {
      it(`includes "${sub}" in RESERVED_VENDOR_SUBROUTES`, () => {
        // Look for the literal string within the Set initializer
        const setMatch = middlewareSrc.match(/RESERVED_VENDOR_SUBROUTES\s*=\s*new Set\(\[([^\]]+)\]\)/);
        expect(setMatch).toBeTruthy();
        const setBody = setMatch![1];
        expect(setBody).toMatch(new RegExp(`["']${sub}["']`));
      });
    }

    it("uses the set to gate /vendors/<reserved>* paths", () => {
      expect(middlewareSrc).toMatch(/RESERVED_VENDOR_SUBROUTES\.has\(/);
      expect(middlewareSrc).toMatch(/isVendorAuthedRoute/);
    });

    it("does NOT gate the public /vendors directory path", () => {
      // Find isProtectedPage block and confirm the literal `pathname === "/vendors"` no longer appears
      // (the new model uses isVendorAuthedRoute which evaluates false for /vendors exact match).
      const protectedBlock = middlewareSrc.match(/const isProtectedPage[\s\S]*?;/);
      expect(protectedBlock).toBeTruthy();
      expect(protectedBlock![0]).not.toMatch(/pathname\s*===\s*["']\/vendors["']/);
    });
  });

  describe("Defense Layer 2 — force-dynamic on every authed vendor route", () => {
    for (const { sub, dynamicFile } of AUTHED_ROUTES) {
      it(`${dynamicFile} declares dynamic = "force-dynamic"`, () => {
        const fullPath = path.join(REPO_ROOT, dynamicFile);
        const src = fs.readFileSync(fullPath, "utf8");
        expect(src).toMatch(/export\s+const\s+dynamic\s*=\s*["']force-dynamic["']/);
      });
    }
  });

  describe("Allowlist sanity — public surfaces enumerable", () => {
    for (const route of PUBLIC_VENDOR_ROUTES) {
      it(`${route} does not match a reserved subroute name`, () => {
        // /vendors and /vendors/activate must remain public. Verify by parsing
        // the URL the same way middleware does.
        const segments = route.split("/").filter(Boolean);
        const isAuthed =
          segments[0] === "vendors" &&
          segments.length >= 2 &&
          AUTHED_ROUTES.some((r) => r.sub === segments[1]);
        expect(isAuthed).toBe(false);
      });
    }

    it("/vendors/<uuid> does not match a reserved subroute (no collision risk)", () => {
      const sampleUuid = "84cfbd2e-eab7-4699-9f69-f4d01a2c796a";
      const segments = `/vendors/${sampleUuid}`.split("/").filter(Boolean);
      const isAuthed = AUTHED_ROUTES.some((r) => r.sub === segments[1]);
      expect(isAuthed).toBe(false);
    });
  });
});
