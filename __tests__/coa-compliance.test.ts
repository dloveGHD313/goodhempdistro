import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { requiresCOA, validateProductCompliance } from "@/lib/compliance";

/**
 * GATE-03 cutover — these tests pin the SSOT contract:
 *
 * requiresCOA() reads `category.requires_coa` directly. The previous
 * hardcoded `COA_EXCEPTION_PATTERNS` slug allowlist has been removed.
 *
 * Safe failure mode (Rule 6 — compliance-safe):
 *   - null/undefined category → returns TRUE + console.warn
 *   - missing requires_coa field on the row → returns TRUE + console.warn
 */

describe("requiresCOA — SSOT semantics (post GATE-03)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns TRUE when category.requires_coa is true (cannabinoid)", () => {
    expect(requiresCOA({ slug: "tinctures", name: "Tinctures", requires_coa: true })).toBe(true);
    expect(requiresCOA({ slug: "edibles", name: "Edibles", requires_coa: true })).toBe(true);
    expect(requiresCOA({ slug: "vapes", name: "Vapes", requires_coa: true })).toBe(true);
    expect(requiresCOA({ slug: "delta-8", name: "Delta-8", requires_coa: true })).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns FALSE when category.requires_coa is explicitly false (apparel, equipment, services)", () => {
    expect(requiresCOA({ slug: "clothing", name: "Clothing", requires_coa: false })).toBe(false);
    expect(requiresCOA({ slug: "accessories", name: "Accessories", requires_coa: false })).toBe(false);
    expect(requiresCOA({ slug: "lab-equipment", name: "Lab Equipment", requires_coa: false })).toBe(false);
    expect(requiresCOA({ slug: "cultivation-consulting", name: "Cultivation Consulting", requires_coa: false })).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does NOT read a slug allowlist (removed in GATE-03)", () => {
    // Pre-GATE-03 these slugs would have matched COA_EXCEPTION_PATTERNS and returned false
    // even with no requires_coa field. Post-cutover, only the DB column matters.
    // Without requires_coa, defaults to TRUE (safe failure).
    expect(requiresCOA({ slug: "clothing", name: "Clothing" })).toBe(true);
    expect(requiresCOA({ slug: "textiles-apparel", name: "Textiles & Apparel" })).toBe(true);
    expect(requiresCOA({ slug: "fabric-yarn", name: "Fabric / Yarn" })).toBe(true);
    // Should have warned about each (no requires_coa field)
    expect(warnSpy).toHaveBeenCalled();
  });

  it("safe failure: returns TRUE when category is null/undefined + warns", () => {
    expect(requiresCOA(null)).toBe(true);
    expect(requiresCOA(undefined)).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it("safe failure: returns TRUE for unknown slug (no requires_coa field) + warns", () => {
    expect(requiresCOA({ slug: "completely-made-up-slug", name: "Made Up" })).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const warnArgs = warnSpy.mock.calls[0][0];
    expect(warnArgs).toContain("completely-made-up-slug");
    expect(warnArgs).toContain("requires_coa=true");
  });

  it("safe failure: requires_coa null (column allows NULL) defaults TRUE + warns", () => {
    expect(requiresCOA({ slug: "x", name: "X", requires_coa: null })).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });
});

const baseDraftPayload = {
  product_type: "non_intoxicating" as const,
  hemp_derived_attestation: true,
};

describe("validateProductCompliance COA enforcement (unchanged by GATE-03)", () => {
  it("draft mode: never returns COA error (Phase 2: COA does not block product create/update)", () => {
    const errors = validateProductCompliance(
      { ...baseDraftPayload, category_requires_coa: true },
      { mode: "draft" }
    );
    expect(errors.filter((e) => e.field === "coa" || e.field === "coa_url").length).toBe(0);
  });

  it("draft mode: returns no COA error when category_requires_coa is false (e.g. apparel)", () => {
    const errors = validateProductCompliance(
      { ...baseDraftPayload, category_requires_coa: false },
      { mode: "draft" }
    );
    expect(errors.filter((e) => e.field === "coa" || e.field === "coa_url").length).toBe(0);
  });

  it("draft mode: returns no COA error when category_requires_coa is true but no COA (Phase 2)", () => {
    const errors = validateProductCompliance(
      { ...baseDraftPayload, category_requires_coa: true, coa_url: "", coa_object_path: "" },
      { mode: "draft" }
    );
    expect(errors.filter((e) => e.field === "coa" || e.field === "coa_url").length).toBe(0);
  });

  it("submit mode: returns COA error when category_requires_coa is true and no COA", () => {
    const errors = validateProductCompliance(
      { ...baseDraftPayload, category_requires_coa: true },
      { mode: "submit" }
    );
    expect(errors.some((e) => e.field === "coa")).toBe(true);
  });

  it("submit mode: returns no COA error when category_requires_coa is true but COA URL provided", () => {
    const errors = validateProductCompliance(
      { ...baseDraftPayload, category_requires_coa: true, coa_url: "https://example.com/coa.pdf" },
      { mode: "submit" }
    );
    expect(errors.filter((e) => e.field === "coa").length).toBe(0);
  });

  it("submit mode: returns no COA error when category_requires_coa is true but coa_object_path provided", () => {
    const errors = validateProductCompliance(
      { ...baseDraftPayload, category_requires_coa: true, coa_object_path: "product-id/coa.pdf" },
      { mode: "submit" }
    );
    expect(errors.filter((e) => e.field === "coa").length).toBe(0);
  });
});

describe("compliance.ts no longer exports COA_EXCEPTION_PATTERNS", () => {
  it("the removed allowlist constant is gone from the module surface", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = (await import("@/lib/compliance")) as any;
    expect(mod.COA_EXCEPTION_PATTERNS).toBeUndefined();
  });
});
