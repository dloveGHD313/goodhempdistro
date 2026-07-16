/**
 * Federal hemp redefinition compliance — P.L. 119-37, effective 2026-11-12
 * (brief 2026-07-16 P0). Verified against CRS IF13136 analysis:
 *
 * 1. Hemp is measured by TOTAL THC including THCA ≤ 0.3% dry weight
 *    (previously delta-9 only).
 * 2. Any final hemp-derived cannabinoid product with > 0.4mg total THC per
 *    container is excluded from the hemp definition (= federally marijuana).
 * 3. Synthesized / non-naturally-produced cannabinoids (e.g. delta-8 from
 *    CBD conversion) are excluded regardless of THC content.
 *
 * ⚠️ ATTORNEY-GATED: enforcement is behind ENFORCE_FEDERAL_2026 (env,
 * default OFF). Flag OFF = zero behavior change anywhere. The CEO flips it
 * after cannabis-attorney sign-off, before the effective date. Nothing
 * auto-deletes either way.
 *
 * Config constants live here (the compliance one-file config, alongside
 * the category matrix in this module's sibling) — tuning is data, not code.
 */

export const FEDERAL_2026 = {
  /** Total THC (incl. THCA) max, % dry weight. */
  totalThcMaxPercent: 0.3,
  /** Total THC max per final product container, mg. */
  totalThcMaxMgPerContainer: 0.4,
  /** Statute effective date. */
  effectiveDate: "2026-11-12",
} as const;

export type Federal2026Status = "compliant" | "non_compliant" | "unknown";

export type Federal2026ProductInput = {
  total_thc_percent?: number | null;
  total_thc_mg_per_container?: number | null;
  contains_synthesized_cannabinoids?: boolean | null;
  /** From the category matrix: does this category require a COA? */
  categoryRequiresCoa: boolean;
};

/** Feature flag — default OFF; CEO flips post-attorney-review. */
export function isFederal2026EnforcementOn(): boolean {
  return process.env.ENFORCE_FEDERAL_2026 === "true";
}

/**
 * Pure evaluation — unit-tested.
 *
 * - Synthesized cannabinoids → non_compliant (regardless of THC values).
 * - total_thc_percent > 0.3 OR total_thc_mg_per_container > 0.4 →
 *   non_compliant. Exact threshold values are compliant (≤ in statute).
 * - Non-COA categories (apparel, paper goods…) with no cannabinoid data →
 *   compliant: they contain no cannabinoids by definition.
 * - COA categories missing any of the three declarations → unknown.
 *   Pre-flag, unknown fails OPEN (warn only); post-flag it fails CLOSED
 *   at the enforcement call sites.
 */
export function evaluateFederal2026Compliance(
  product: Federal2026ProductInput
): Federal2026Status {
  const pct = product.total_thc_percent;
  const mg = product.total_thc_mg_per_container;
  const synthesized = product.contains_synthesized_cannabinoids;

  if (synthesized === true) return "non_compliant";
  if (typeof pct === "number" && pct > FEDERAL_2026.totalThcMaxPercent) {
    return "non_compliant";
  }
  if (typeof mg === "number" && mg > FEDERAL_2026.totalThcMaxMgPerContainer) {
    return "non_compliant";
  }

  const hasAllDeclarations =
    typeof pct === "number" && typeof mg === "number" && typeof synthesized === "boolean";
  if (hasAllDeclarations) return "compliant";

  // No declarations at all on a COA-exempt category: no cannabinoid content.
  const hasAnyDeclaration =
    pct != null || mg != null || synthesized != null;
  if (!product.categoryRequiresCoa && !hasAnyDeclaration) return "compliant";

  return "unknown";
}

/**
 * Should this product be blocked (checkout) / hidden (shop)?
 * Flag OFF → never. Flag ON → non_compliant always blocked; unknown fails
 * CLOSED (COA categories must have declarations on file by then).
 */
export function isBlockedByFederal2026(
  product: Federal2026ProductInput,
  enforcementOn: boolean = isFederal2026EnforcementOn()
): boolean {
  if (!enforcementOn) return false;
  return evaluateFederal2026Compliance(product) !== "compliant";
}

/** Vendor-facing warning copy (dashboard banner / status column). */
export function federal2026WarningText(status: Federal2026Status): string | null {
  if (status === "non_compliant") {
    return `This product may not meet the federal hemp definition effective Nov 12, 2026 (total THC incl. THCA ≤ ${FEDERAL_2026.totalThcMaxPercent}% and ≤ ${FEDERAL_2026.totalThcMaxMgPerContainer}mg total THC per container; synthesized cannabinoids excluded).`;
  }
  if (status === "unknown") {
    return "Total-THC declarations are missing for this product. Add total THC %, mg per container, and the synthesized-cannabinoid declaration from your COA before Nov 12, 2026.";
  }
  return null;
}
