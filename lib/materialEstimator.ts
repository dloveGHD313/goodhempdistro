/**
 * Hemp building material estimator (pure logic; used by /projects/estimator).
 *
 * Produces PLANNING ESTIMATES, not engineering quantities. Mix constants are
 * the commonly published cast-in-place hempcrete wall mix used across the US
 * hemp building trade (per cubic meter of placed hempcrete):
 *   ~100 kg hemp hurd, ~150 kg lime binder, ~300 L water
 * (see e.g. published hempcrete construction guides / US Hemp Building
 * Association materials). Real jobs vary with binder brand, wall system, and
 * waste factor — the UI must label outputs as estimates and recommend
 * verifying with the installer/engineer.
 */

export const HEMPCRETE_MIX = {
  hurdKgPerM3: 100,
  binderKgPerM3: 150,
  waterLitersPerM3: 300,
  /** Typical retail packaging for conversion to shopping-list units. */
  hurdKgPerBale: 15, // ~33 lb bale
  binderKgPerBag: 25, // ~55 lb bag
  /** Default waste factor applied to all quantities. */
  wasteFactor: 1.1,
} as const;

export const UNIT_CONVERSIONS = {
  sqftPerM2: 10.7639,
  cubicFtPerM3: 35.3147,
  lbPerKg: 2.20462,
  galPerLiter: 0.264172,
  inchesPerMeter: 39.3701,
} as const;

/** Face area of a typical hempcrete block (600mm x 300mm) in sqft. */
export const BLOCK_FACE_SQFT = 1.94;
/** Coverage of a typical hemp batt insulation unit — estimator works in sqft directly. */

export type EstimatorInput = {
  /** Net wall area in square feet (gross walls minus openings). */
  wallAreaSqft: number;
  /** Wall thickness in inches (typical cast hempcrete: 8, 10, or 12). */
  wallThicknessInches: number;
  /** Optional: area to insulate with hemp batts (roof/attic/floor), sqft. */
  insulationAreaSqft?: number;
  /** Optional: build walls from hemp blocks instead of cast-in-place. */
  useBlocks?: boolean;
};

export type EstimateLine = {
  /** Category id matching lib/server/projectMatching PROJECT_CATEGORY_OPTIONS. */
  categoryId: string;
  label: string;
  quantity: number;
  unit: string;
  detail: string;
};

export type MaterialEstimate = {
  hempcreteVolumeCuFt: number;
  hempcreteVolumeM3: number;
  lines: EstimateLine[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const ceil = Math.ceil;

export function estimateMaterials(input: EstimatorInput): MaterialEstimate {
  const wallAreaSqft = Math.max(0, Number(input.wallAreaSqft) || 0);
  const thicknessIn = Math.max(0, Number(input.wallThicknessInches) || 0);
  const insulationSqft = Math.max(0, Number(input.insulationAreaSqft) || 0);

  const wallAreaM2 = wallAreaSqft / UNIT_CONVERSIONS.sqftPerM2;
  const thicknessM = thicknessIn / UNIT_CONVERSIONS.inchesPerMeter;
  const volumeM3 = wallAreaM2 * thicknessM * HEMPCRETE_MIX.wasteFactor;
  const volumeCuFt = volumeM3 * UNIT_CONVERSIONS.cubicFtPerM3;

  const lines: EstimateLine[] = [];

  if (wallAreaSqft > 0 && thicknessIn > 0) {
    if (input.useBlocks) {
      const blocks = ceil((wallAreaSqft / BLOCK_FACE_SQFT) * HEMPCRETE_MIX.wasteFactor);
      lines.push({
        categoryId: "blocks-panels",
        label: "Hemp blocks (600×300mm face)",
        quantity: blocks,
        unit: "blocks",
        detail: `${round1(wallAreaSqft)} sq ft of wall incl. ~10% waste`,
      });
      // Block walls still need a binder-based mortar/plaster — rough allowance.
      const mortarBags = ceil((wallAreaSqft / 100) * 2);
      lines.push({
        categoryId: "binder",
        label: "Lime binder (mortar/plaster allowance)",
        quantity: mortarBags,
        unit: "bags (~55 lb)",
        detail: "Rough allowance of 2 bags per 100 sq ft of block wall",
      });
    } else {
      const hurdKg = volumeM3 * HEMPCRETE_MIX.hurdKgPerM3;
      const binderKg = volumeM3 * HEMPCRETE_MIX.binderKgPerM3;
      const waterL = volumeM3 * HEMPCRETE_MIX.waterLitersPerM3;
      lines.push({
        categoryId: "hurd",
        label: "Hemp hurd",
        quantity: ceil(hurdKg / HEMPCRETE_MIX.hurdKgPerBale),
        unit: "bales (~33 lb)",
        detail: `${Math.round(hurdKg * UNIT_CONVERSIONS.lbPerKg)} lb total incl. ~10% waste`,
      });
      lines.push({
        categoryId: "binder",
        label: "Lime binder",
        quantity: ceil(binderKg / HEMPCRETE_MIX.binderKgPerBag),
        unit: "bags (~55 lb)",
        detail: `${Math.round(binderKg * UNIT_CONVERSIONS.lbPerKg)} lb total incl. ~10% waste`,
      });
      lines.push({
        categoryId: "hempcrete",
        label: "Mixing water",
        quantity: Math.round(waterL * UNIT_CONVERSIONS.galPerLiter),
        unit: "gallons",
        detail: "On-site water for the hempcrete mix",
      });
    }
  }

  if (insulationSqft > 0) {
    lines.push({
      categoryId: "insulation",
      label: "Hemp batt insulation",
      quantity: ceil(insulationSqft * HEMPCRETE_MIX.wasteFactor),
      unit: "sq ft",
      detail: `${round1(insulationSqft)} sq ft of coverage incl. ~10% waste`,
    });
  }

  return {
    hempcreteVolumeCuFt: round1(volumeCuFt),
    hempcreteVolumeM3: round1(volumeM3),
    lines,
  };
}

/** Category ids present in an estimate — used to prefill /projects/submit. */
export function estimateCategoryIds(estimate: MaterialEstimate): string[] {
  return Array.from(new Set(estimate.lines.map((l) => l.categoryId)));
}
