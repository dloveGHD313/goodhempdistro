/**
 * Category compliance matrix (shop brief 2026-07-14 P1).
 *
 * All flags live on the categories table — CEO-tunable, no code changes.
 * legal_review_status is the loosening gate: a 'pending' (or unknown)
 * category is treated FULLY RESTRICTIVE — COA required, 21+ required —
 * regardless of its stored flags. Only 'approved' rows get their flags
 * honored as-is. Never hardcode per-state legal conclusions here; state
 * divergence lives in ship_restricted_states data.
 */

import { normalizeUsState } from "@/lib/usStates";

export type CategoryComplianceRow = {
  id: string;
  name?: string | null;
  requires_coa?: boolean | null;
  requires_age_21?: boolean | null;
  requires_vendor_license_doc?: boolean | null;
  ship_restricted_states?: string[] | null;
  legal_review_status?: string | null;
};

export type EffectiveCompliance = {
  requiresCoa: boolean;
  requiresAge21: boolean;
  requiresVendorLicenseDoc: boolean;
  shipRestrictedStates: string[];
  legalReviewPending: boolean;
};

/** Restrictive default: unknown category = COA + 21+ required. */
export const RESTRICTIVE_COMPLIANCE: EffectiveCompliance = {
  requiresCoa: true,
  requiresAge21: true,
  requiresVendorLicenseDoc: false,
  shipRestrictedStates: [],
  legalReviewPending: true,
};

/** Pure — unit-tested. Applies the pending→restrictive rule. */
export function effectiveCategoryCompliance(
  row: CategoryComplianceRow | null | undefined
): EffectiveCompliance {
  if (!row) return RESTRICTIVE_COMPLIANCE;
  const approved = row.legal_review_status === "approved";
  if (!approved) {
    return {
      ...RESTRICTIVE_COMPLIANCE,
      requiresVendorLicenseDoc: row.requires_vendor_license_doc === true,
      shipRestrictedStates: normalizeStates(row.ship_restricted_states),
    };
  }
  return {
    requiresCoa: row.requires_coa !== false, // null/undefined → true (GATE-03 safe default)
    requiresAge21: row.requires_age_21 === true,
    requiresVendorLicenseDoc: row.requires_vendor_license_doc === true,
    shipRestrictedStates: normalizeStates(row.ship_restricted_states),
    legalReviewPending: false,
  };
}

function normalizeStates(states: string[] | null | undefined): string[] {
  return (states || [])
    .map((s) => normalizeUsState(s))
    .filter((s): s is string => s !== null);
}

/** Is this category blocked from shipping/sale to the given state? */
export function isCategoryRestrictedInState(
  compliance: EffectiveCompliance,
  state: string | null | undefined
): boolean {
  const code = normalizeUsState(state);
  if (!code) return false; // unknown viewer state: don't hide (checkout re-checks)
  return compliance.shipRestrictedStates.includes(code);
}

export type ListingGateInput = {
  compliance: EffectiveCompliance;
  hasCoa: boolean;
  vendorHasLicenseDoc: boolean;
};

export type ListingGateResult = {
  canSubmit: boolean;
  /** Machine-readable requirements still missing. */
  missing: Array<"coa" | "vendor_license_doc">;
};

/**
 * Upload-time enforcement (brief §3): which documents must be on file
 * before this listing can go to review/active. Pure — unit-tested.
 * Non-gated categories (apparel, paper plates…) return canSubmit=true
 * with no requirements.
 */
export function evaluateListingGate(input: ListingGateInput): ListingGateResult {
  const missing: ListingGateResult["missing"] = [];
  if (input.compliance.requiresCoa && !input.hasCoa) {
    missing.push("coa");
  }
  if (input.compliance.requiresVendorLicenseDoc && !input.vendorHasLicenseDoc) {
    missing.push("vendor_license_doc");
  }
  return { canSubmit: missing.length === 0, missing };
}

/**
 * Fetch one category's compliance row. Unknown/missing → restrictive.
 * Accepts any Supabase client (route handler, server, or admin).
 */
export async function getCategoryCompliance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- avoids deep Supabase generic instantiation
  supabase: any,
  categoryId: string | null | undefined
): Promise<EffectiveCompliance> {
  if (!categoryId || !String(categoryId).trim()) return RESTRICTIVE_COMPLIANCE;
  const { data, error } = await supabase
    .from("categories")
    .select(
      "id, name, requires_coa, requires_age_21, requires_vendor_license_doc, ship_restricted_states, legal_review_status"
    )
    .eq("id", String(categoryId).trim())
    .maybeSingle();
  if (error || !data) {
    if (error) {
      console.warn("[category-compliance] lookup failed — restrictive default:", error.message);
    }
    return RESTRICTIVE_COMPLIANCE;
  }
  return effectiveCategoryCompliance(data as CategoryComplianceRow);
}

/** Batch: category id → effective compliance (unknown ids restrictive). */
export async function getCategoryComplianceMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  categoryIds: string[]
): Promise<Record<string, EffectiveCompliance>> {
  const unique = Array.from(
    new Set(categoryIds.filter((id) => typeof id === "string" && id.trim().length > 0))
  );
  const map: Record<string, EffectiveCompliance> = {};
  for (const id of unique) map[id] = RESTRICTIVE_COMPLIANCE;
  if (unique.length === 0) return map;
  const { data, error } = await supabase
    .from("categories")
    .select(
      "id, name, requires_coa, requires_age_21, requires_vendor_license_doc, ship_restricted_states, legal_review_status"
    )
    .in("id", unique);
  if (error) {
    console.warn("[category-compliance] batch lookup failed — restrictive defaults:", error.message);
    return map;
  }
  for (const row of (data || []) as CategoryComplianceRow[]) {
    map[row.id] = effectiveCategoryCompliance(row);
  }
  return map;
}
