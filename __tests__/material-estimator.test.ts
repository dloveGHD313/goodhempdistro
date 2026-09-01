/**
 * Material estimator (blueprint/estimator build).
 */

import { describe, expect, it } from "vitest";

import {
  estimateMaterials,
  estimateCategoryIds,
  HEMPCRETE_MIX,
} from "@/lib/materialEstimator";

describe("estimateMaterials — cast-in-place", () => {
  // 1000 sq ft of wall at 12" thick → 1000 cu ft raw → ~92.9 m³ raw → ×1.1 waste
  const est = estimateMaterials({ wallAreaSqft: 1000, wallThicknessInches: 12 });

  it("computes hempcrete volume with the 10% waste factor", () => {
    // 1000 sqft = 92.903 m²; 12in = 0.3048m → 28.317 m³ ×1.1 = 31.148 m³
    expect(est.hempcreteVolumeM3).toBeCloseTo(31.1, 0);
    expect(est.hempcreteVolumeCuFt).toBeCloseTo(1100, -1);
  });

  it("produces hurd, binder, and water lines mapped to matching categories", () => {
    const ids = est.lines.map((l) => l.categoryId);
    expect(ids).toContain("hurd");
    expect(ids).toContain("binder");
    expect(ids).toContain("hempcrete");
  });

  it("converts hurd to ~15kg bales and binder to ~25kg bags", () => {
    const hurd = est.lines.find((l) => l.categoryId === "hurd")!;
    const binder = est.lines.find((l) => l.categoryId === "binder")!;
    // 31.148 m³ × 100 kg = 3114.8 kg → /15 = 207.65 → 208 bales
    expect(hurd.quantity).toBe(Math.ceil((est.hempcreteVolumeM3 * HEMPCRETE_MIX.hurdKgPerM3) / 15));
    expect(binder.quantity).toBe(
      Math.ceil((est.hempcreteVolumeM3 * HEMPCRETE_MIX.binderKgPerM3) / 25)
    );
    expect(hurd.quantity).toBeGreaterThan(150);
    expect(binder.quantity).toBeGreaterThan(150);
  });
});

describe("estimateMaterials — blocks and insulation", () => {
  it("block mode swaps hurd/water for blocks + mortar allowance", () => {
    const est = estimateMaterials({
      wallAreaSqft: 500,
      wallThicknessInches: 12,
      useBlocks: true,
    });
    const ids = est.lines.map((l) => l.categoryId);
    expect(ids).toContain("blocks-panels");
    expect(ids).toContain("binder");
    expect(ids).not.toContain("hurd");
    const blocks = est.lines.find((l) => l.categoryId === "blocks-panels")!;
    // 500 / 1.94 × 1.1 = 283.5 → 284
    expect(blocks.quantity).toBe(284);
  });

  it("insulation-only estimates work without wall inputs", () => {
    const est = estimateMaterials({
      wallAreaSqft: 0,
      wallThicknessInches: 0,
      insulationAreaSqft: 1200,
    });
    expect(est.lines).toHaveLength(1);
    expect(est.lines[0].categoryId).toBe("insulation");
    expect(est.lines[0].quantity).toBe(1320); // 1200 × 1.1
  });

  it("garbage inputs produce an empty estimate, not NaN", () => {
    const est = estimateMaterials({
      wallAreaSqft: Number.NaN,
      wallThicknessInches: -5,
    });
    expect(est.lines).toHaveLength(0);
    expect(est.hempcreteVolumeCuFt).toBe(0);
  });
});

describe("estimateCategoryIds", () => {
  it("deduplicates category ids for the submit-page handoff", () => {
    const est = estimateMaterials({
      wallAreaSqft: 1000,
      wallThicknessInches: 12,
      insulationAreaSqft: 500,
    });
    const ids = estimateCategoryIds(est);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["hurd", "binder", "hempcrete", "insulation"]));
  });
});
