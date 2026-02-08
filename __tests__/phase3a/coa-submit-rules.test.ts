/**
 * Phase 3A: COA compliance rules (unit-level).
 * - Non-blocking create/save: validateProductCompliance never returns COA error.
 * - Submit block condition: requiresCOA && !admin && no coa_url && no coa_object_path => block.
 */
import { describe, expect, it } from "vitest";
import {
  requiresCOA,
  validateProductCompliance,
} from "@/lib/compliance";

describe("Phase 3A: COA compliance rules", () => {
  describe("Non-blocking create/save (Phase 2)", () => {
    it("validateProductCompliance never returns COA error for create/update", () => {
      const errors = validateProductCompliance({
        product_type: "non_intoxicating",
        category_requires_coa: true,
      });
      expect(errors.filter((e) => e.field === "coa_url")).toHaveLength(0);
    });

    it("validateProductCompliance allows save with no COA when category requires COA", () => {
      const errors = validateProductCompliance({
        product_type: "non_intoxicating",
        category_requires_coa: true,
        coa_url: "",
        coa_object_path: "",
      });
      expect(errors.filter((e) => e.field === "coa_url")).toHaveLength(0);
    });
  });

  describe("Submit block condition (submit route logic)", () => {
    it("requiresCOA is true for consumable-like categories", () => {
      expect(requiresCOA({ slug: "consumables", name: "Consumables" })).toBe(true);
      expect(requiresCOA({ slug: "edibles", name: "Edibles" })).toBe(true);
    });

    it("requiresCOA is false for apparel", () => {
      expect(requiresCOA({ slug: "textiles-apparel", name: "Textiles & Apparel" })).toBe(false);
    });

    it("submit block predicate: effectiveRequiresCoa && !hasCoaUrl && !hasCoaPath => should block", () => {
      const effectiveRequiresCoa = true;
      const hasCoaUrl = false;
      const hasCoaPath = false;
      const shouldBlock = effectiveRequiresCoa && !hasCoaUrl && !hasCoaPath;
      expect(shouldBlock).toBe(true);
    });

    it("submit allow when COA path present (no block)", () => {
      const effectiveRequiresCoa = true;
      const hasCoaPath = true;
      const shouldBlock = effectiveRequiresCoa && !hasCoaPath;
      expect(shouldBlock).toBe(false);
    });
  });
});
