import { afterEach, describe, expect, it } from "vitest";
import {
  FEDERAL_2026,
  evaluateFederal2026Compliance,
  isBlockedByFederal2026,
  isFederal2026EnforcementOn,
  federal2026WarningText,
} from "@/lib/compliance/federal2026";

/**
 * P.L. 119-37 (effective 2026-11-12) — brief 2026-07-16 P0.
 * Enforcement is behind ENFORCE_FEDERAL_2026 (default OFF).
 */

const coaProduct = (overrides: Record<string, unknown> = {}) => ({
  total_thc_percent: 0.1,
  total_thc_mg_per_container: 0.2,
  contains_synthesized_cannabinoids: false,
  categoryRequiresCoa: true,
  ...overrides,
});

afterEach(() => {
  delete process.env.ENFORCE_FEDERAL_2026;
});

describe("config constants", () => {
  it("pins the statutory thresholds and effective date", () => {
    expect(FEDERAL_2026.totalThcMaxPercent).toBe(0.3);
    expect(FEDERAL_2026.totalThcMaxMgPerContainer).toBe(0.4);
    expect(FEDERAL_2026.effectiveDate).toBe("2026-11-12");
  });
});

describe("evaluateFederal2026Compliance", () => {
  it("threshold edges: exactly 0.3% and exactly 0.4mg are COMPLIANT (≤ in statute)", () => {
    expect(
      evaluateFederal2026Compliance(coaProduct({ total_thc_percent: 0.3 }))
    ).toBe("compliant");
    expect(
      evaluateFederal2026Compliance(coaProduct({ total_thc_mg_per_container: 0.4 }))
    ).toBe("compliant");
  });

  it("just over either threshold is non_compliant", () => {
    expect(
      evaluateFederal2026Compliance(coaProduct({ total_thc_percent: 0.301 }))
    ).toBe("non_compliant");
    expect(
      evaluateFederal2026Compliance(coaProduct({ total_thc_mg_per_container: 0.41 }))
    ).toBe("non_compliant");
  });

  it("synthesized cannabinoids are non_compliant regardless of THC values", () => {
    expect(
      evaluateFederal2026Compliance(
        coaProduct({
          contains_synthesized_cannabinoids: true,
          total_thc_percent: 0,
          total_thc_mg_per_container: 0,
        })
      )
    ).toBe("non_compliant");
  });

  it("COA category missing any declaration → unknown", () => {
    expect(
      evaluateFederal2026Compliance(coaProduct({ total_thc_percent: null }))
    ).toBe("unknown");
    expect(
      evaluateFederal2026Compliance(coaProduct({ contains_synthesized_cannabinoids: null }))
    ).toBe("unknown");
  });

  it("COA-exempt category (apparel) with no declarations → compliant", () => {
    expect(
      evaluateFederal2026Compliance({
        total_thc_percent: null,
        total_thc_mg_per_container: null,
        contains_synthesized_cannabinoids: null,
        categoryRequiresCoa: false,
      })
    ).toBe("compliant");
  });

  it("an over-threshold value is non_compliant even for a COA-exempt category", () => {
    expect(
      evaluateFederal2026Compliance({
        total_thc_percent: 5,
        categoryRequiresCoa: false,
      })
    ).toBe("non_compliant");
  });
});

describe("enforcement flag", () => {
  it("flag OFF (default) = zero behavior change: nothing is blocked, ever", () => {
    expect(isFederal2026EnforcementOn()).toBe(false);
    expect(isBlockedByFederal2026(coaProduct({ total_thc_percent: 99 }))).toBe(false);
    expect(isBlockedByFederal2026(coaProduct({ total_thc_percent: null }))).toBe(false);
  });

  it("flag ON: non_compliant blocked; unknown fails CLOSED; compliant passes", () => {
    process.env.ENFORCE_FEDERAL_2026 = "true";
    expect(isBlockedByFederal2026(coaProduct({ total_thc_percent: 99 }))).toBe(true);
    expect(isBlockedByFederal2026(coaProduct({ total_thc_percent: null }))).toBe(true); // unknown → closed
    expect(isBlockedByFederal2026(coaProduct())).toBe(false);
    // COA-exempt goods with no cannabinoid data stay purchasable
    expect(
      isBlockedByFederal2026({
        total_thc_percent: null,
        total_thc_mg_per_container: null,
        contains_synthesized_cannabinoids: null,
        categoryRequiresCoa: false,
      })
    ).toBe(false);
  });
});

describe("federal2026WarningText", () => {
  it("warns for non_compliant and unknown; silent for compliant", () => {
    expect(federal2026WarningText("non_compliant")).toMatch(/Nov 12, 2026/);
    expect(federal2026WarningText("unknown")).toMatch(/declarations/i);
    expect(federal2026WarningText("compliant")).toBeNull();
  });
});
