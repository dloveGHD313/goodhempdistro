import { describe, expect, it } from "vitest";
import { requiresCOA, validateProductCompliance } from "@/lib/compliance";

describe("requiresCOA", () => {
  it("returns false for apparel categories (COA not required)", () => {
    expect(requiresCOA({ slug: "textiles-apparel", name: "Textiles & Apparel" })).toBe(false);
    expect(requiresCOA({ slug: "clothing", name: "Clothing" })).toBe(false);
    expect(requiresCOA({ slug: "fabric-yarn", name: "Fabric / Yarn" })).toBe(false);
    expect(requiresCOA({ slug: "accessories", name: "Accessories" })).toBe(false);
    expect(requiresCOA({ slug: "apparel", name: "Apparel" })).toBe(false);
  });

  it("returns false for non-consumable home goods (COA not required)", () => {
    expect(requiresCOA({ slug: "home-goods", name: "Home Goods" })).toBe(false);
    expect(requiresCOA({ slug: "curtains", name: "Curtains" })).toBe(false);
    expect(requiresCOA({ slug: "blinds", name: "Blinds" })).toBe(false);
    expect(requiresCOA({ slug: "decor", name: "Decor" })).toBe(false);
    expect(requiresCOA({ slug: "home-decor", name: "Home Decor" })).toBe(false);
  });

  it("returns true for consumable / topical / inhalable / wellness / recreational / industrial", () => {
    expect(requiresCOA({ slug: "consumables", name: "Consumables" })).toBe(true);
    expect(requiresCOA({ slug: "edibles", name: "Edibles" })).toBe(true);
    expect(requiresCOA({ slug: "topicals-body", name: "Topicals & Body" })).toBe(true);
    expect(requiresCOA({ slug: "vapes", name: "Vapes" })).toBe(true);
    expect(requiresCOA({ slug: "tinctures", name: "Tinctures" })).toBe(true);
    expect(requiresCOA({ slug: "industrial-hemp-materials", name: "Industrial Hemp Materials" })).toBe(true);
    expect(requiresCOA({ slug: "bulk-flower", name: "Bulk Flower" })).toBe(true);
  });

  it("returns true when category is null/undefined (safe default)", () => {
    expect(requiresCOA(null)).toBe(true);
    expect(requiresCOA(undefined)).toBe(true);
    expect(requiresCOA({})).toBe(true);
  });
});

const baseDraftPayload = {
  product_type: "non_intoxicating" as const,
  hemp_derived_attestation: true,
};

describe("validateProductCompliance COA enforcement", () => {
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
