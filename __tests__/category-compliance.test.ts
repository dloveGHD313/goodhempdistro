import { describe, expect, it } from "vitest";
import {
  RESTRICTIVE_COMPLIANCE,
  effectiveCategoryCompliance,
  evaluateListingGate,
  isCategoryRestrictedInState,
  type CategoryComplianceRow,
} from "@/lib/compliance/categoryCompliance";

function row(overrides: Partial<CategoryComplianceRow>): CategoryComplianceRow {
  return {
    id: "cat-1",
    name: "Test",
    requires_coa: false,
    requires_age_21: false,
    requires_vendor_license_doc: false,
    ship_restricted_states: [],
    legal_review_status: "approved",
    ...overrides,
  };
}

describe("effectiveCategoryCompliance (brief 2026-07-14 P1)", () => {
  it("approved COA-exempt category (apparel): nothing required", () => {
    const c = effectiveCategoryCompliance(row({ name: "Clothing" }));
    expect(c.requiresCoa).toBe(false);
    expect(c.requiresAge21).toBe(false);
    expect(c.requiresVendorLicenseDoc).toBe(false);
    expect(c.legalReviewPending).toBe(false);
  });

  it("approved category honors its stored flags", () => {
    const c = effectiveCategoryCompliance(
      row({ name: "Vapes", requires_coa: true, requires_age_21: true })
    );
    expect(c.requiresCoa).toBe(true);
    expect(c.requiresAge21).toBe(true);
  });

  it("legal_review_status pending → fully restrictive regardless of flags", () => {
    const c = effectiveCategoryCompliance(
      row({ name: "Hemp Paper Products", requires_coa: false, legal_review_status: "pending" })
    );
    expect(c.requiresCoa).toBe(true);
    expect(c.requiresAge21).toBe(true);
    expect(c.legalReviewPending).toBe(true);
  });

  it("unknown/missing category → restrictive default", () => {
    expect(effectiveCategoryCompliance(null)).toEqual(RESTRICTIVE_COMPLIANCE);
    expect(effectiveCategoryCompliance(undefined)).toEqual(RESTRICTIVE_COMPLIANCE);
  });

  it("null requires_coa on an approved row → true (GATE-03 safe default)", () => {
    expect(effectiveCategoryCompliance(row({ requires_coa: null })).requiresCoa).toBe(true);
  });

  it("normalizes ship_restricted_states to USPS codes, dropping garbage", () => {
    const c = effectiveCategoryCompliance(
      row({ ship_restricted_states: ["ID", "kansas", "nashville", ""] })
    );
    expect(c.shipRestrictedStates).toEqual(["ID", "KS"]);
  });
});

describe("evaluateListingGate — enforcement at upload (brief §3)", () => {
  const apparel = effectiveCategoryCompliance(row({ name: "Clothing" }));
  const coaCategory = effectiveCategoryCompliance(row({ requires_coa: true }));
  const licenseCategory = effectiveCategoryCompliance(
    row({ requires_vendor_license_doc: true })
  );

  it("COA-exempt category is listable with no docs", () => {
    const gate = evaluateListingGate({
      compliance: apparel,
      hasCoa: false,
      vendorHasLicenseDoc: false,
    });
    expect(gate).toEqual({ canSubmit: true, missing: [] });
  });

  it("COA-required category blocks without a COA and passes with one", () => {
    expect(
      evaluateListingGate({ compliance: coaCategory, hasCoa: false, vendorHasLicenseDoc: false })
    ).toEqual({ canSubmit: false, missing: ["coa"] });
    expect(
      evaluateListingGate({ compliance: coaCategory, hasCoa: true, vendorHasLicenseDoc: false })
    ).toEqual({ canSubmit: true, missing: [] });
  });

  it("license-required category blocks without a vendor license doc", () => {
    expect(
      evaluateListingGate({ compliance: licenseCategory, hasCoa: false, vendorHasLicenseDoc: false })
    ).toEqual({ canSubmit: false, missing: ["vendor_license_doc"] });
    expect(
      evaluateListingGate({ compliance: licenseCategory, hasCoa: false, vendorHasLicenseDoc: true })
    ).toEqual({ canSubmit: true, missing: [] });
  });
});

describe("isCategoryRestrictedInState", () => {
  const restricted = effectiveCategoryCompliance(row({ ship_restricted_states: ["ID", "KS"] }));

  it("hides the category for consumers in a restricted state (any format)", () => {
    expect(isCategoryRestrictedInState(restricted, "ID")).toBe(true);
    expect(isCategoryRestrictedInState(restricted, "idaho")).toBe(true);
  });

  it("visible everywhere else, and when viewer state is unknown", () => {
    expect(isCategoryRestrictedInState(restricted, "TN")).toBe(false);
    expect(isCategoryRestrictedInState(restricted, null)).toBe(false);
    expect(isCategoryRestrictedInState(restricted, "nashville")).toBe(false);
  });
});
