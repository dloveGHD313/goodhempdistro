import { describe, it, expect } from "vitest";
import { normalizeUsState, sameUsState } from "@/lib/usStates";

/**
 * P1 regression contract (storefront audit 2026-07-10): Discover dropped
 * the "good hemp distro" vendor (state="tennessee") for a TN viewer because
 * fetchVendors exact-matched .eq("state", "TN"). Both sides now normalize
 * to USPS codes before comparing.
 */

describe("normalizeUsState", () => {
  it("passes through valid USPS codes, any case, trimmed", () => {
    expect(normalizeUsState("TN")).toBe("TN");
    expect(normalizeUsState("tn")).toBe("TN");
    expect(normalizeUsState(" tn ")).toBe("TN");
    expect(normalizeUsState("MI")).toBe("MI");
  });

  it("maps full state names, any case (the production data shapes)", () => {
    expect(normalizeUsState("Tennessee")).toBe("TN");
    expect(normalizeUsState("tennessee")).toBe("TN"); // good hemp distro's actual value
    expect(normalizeUsState("michigan")).toBe("MI"); // Good Hemp Distros' actual value
    expect(normalizeUsState("New Hampshire")).toBe("NH");
  });

  it("returns null for unrecognizable values (cities, garbage, empty, null)", () => {
    expect(normalizeUsState("nashville")).toBeNull(); // actual bad row value
    expect(normalizeUsState("XX")).toBeNull();
    expect(normalizeUsState("")).toBeNull();
    expect(normalizeUsState("   ")).toBeNull();
    expect(normalizeUsState(null)).toBeNull();
    expect(normalizeUsState(undefined)).toBeNull();
  });
});

describe("sameUsState", () => {
  it("THE case: viewer 'TN' matches vendor 'tennessee'", () => {
    expect(sameUsState("TN", "tennessee")).toBe(true);
  });

  it("code-to-code and name-to-name match", () => {
    expect(sameUsState("TN", "tn")).toBe(true);
    expect(sameUsState("Tennessee", "tennessee")).toBe(true);
  });

  it("different states don't match", () => {
    expect(sameUsState("TN", "michigan")).toBe(false);
  });

  it("unrecognizable values never match — including against each other", () => {
    expect(sameUsState("TN", "nashville")).toBe(false);
    expect(sameUsState("nashville", "nashville")).toBe(false); // null !== null guard
    expect(sameUsState(null, "TN")).toBe(false);
    expect(sameUsState(null, null)).toBe(false);
  });
});
