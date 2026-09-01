"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  estimateMaterials,
  estimateCategoryIds,
  type EstimatorInput,
} from "@/lib/materialEstimator";

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export default function EstimatorClient() {
  const [wallLength, setWallLength] = useState("");
  const [wallHeight, setWallHeight] = useState("");
  const [openings, setOpenings] = useState("");
  const [thickness, setThickness] = useState("12");
  const [useBlocks, setUseBlocks] = useState(false);
  const [insulationArea, setInsulationArea] = useState("");

  const wallAreaSqft = Math.max(0, num(wallLength) * num(wallHeight) - num(openings));

  const estimate = useMemo(() => {
    const input: EstimatorInput = {
      wallAreaSqft,
      wallThicknessInches: num(thickness),
      insulationAreaSqft: num(insulationArea),
      useBlocks,
    };
    return estimateMaterials(input);
  }, [wallAreaSqft, thickness, insulationArea, useBlocks]);

  const hasResults = estimate.lines.length > 0;
  const submitHref = hasResults
    ? `/projects/submit?cats=${estimateCategoryIds(estimate).join(",")}`
    : "/projects/submit";

  const selectStyle = {
    backgroundColor: "var(--surface, #141F1A)",
    color: "var(--foreground, #F0EDE6)",
  } as const;

  return (
    <div className="space-y-6">
      <div className="card-glass p-6 md:p-8 space-y-5">
        <h2 className="font-bold text-lg">Walls</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="wallLength" className="block text-sm font-medium text-muted mb-1">
              Total wall length (ft)
            </label>
            <input
              id="wallLength"
              type="number"
              min="0"
              inputMode="decimal"
              value={wallLength}
              onChange={(e) => setWallLength(e.target.value)}
              className="input-shell w-full"
              placeholder="e.g. 140"
            />
          </div>
          <div>
            <label htmlFor="wallHeight" className="block text-sm font-medium text-muted mb-1">
              Wall height (ft)
            </label>
            <input
              id="wallHeight"
              type="number"
              min="0"
              inputMode="decimal"
              value={wallHeight}
              onChange={(e) => setWallHeight(e.target.value)}
              className="input-shell w-full"
              placeholder="e.g. 9"
            />
          </div>
          <div>
            <label htmlFor="openings" className="block text-sm font-medium text-muted mb-1">
              Windows/doors (sq ft)
            </label>
            <input
              id="openings"
              type="number"
              min="0"
              inputMode="decimal"
              value={openings}
              onChange={(e) => setOpenings(e.target.value)}
              className="input-shell w-full"
              placeholder="e.g. 120"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 items-end">
          <div>
            <label htmlFor="thickness" className="block text-sm font-medium text-muted mb-1">
              Wall thickness
            </label>
            <select
              id="thickness"
              value={thickness}
              onChange={(e) => setThickness(e.target.value)}
              className="input-shell w-full"
              style={selectStyle}
            >
              <option value="8">8 inches</option>
              <option value="10">10 inches</option>
              <option value="12">12 inches (typical)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm pb-2">
            <input
              type="checkbox"
              checked={useBlocks}
              onChange={(e) => setUseBlocks(e.target.checked)}
              className="accent-[var(--brand-lime)]"
            />
            Use hemp blocks instead of cast-in-place hempcrete
          </label>
        </div>

        <h2 className="font-bold text-lg pt-2">Insulation (optional)</h2>
        <div>
          <label htmlFor="insulationArea" className="block text-sm font-medium text-muted mb-1">
            Roof / attic / floor area to insulate with hemp batts (sq ft)
          </label>
          <input
            id="insulationArea"
            type="number"
            min="0"
            inputMode="decimal"
            value={insulationArea}
            onChange={(e) => setInsulationArea(e.target.value)}
            className="input-shell w-full"
            placeholder="e.g. 1200"
          />
        </div>
      </div>

      <div className="card-glass p-6 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Estimated materials</h2>
          {wallAreaSqft > 0 && (
            <span className="text-sm text-muted">
              Net wall area: {Math.round(wallAreaSqft)} sq ft
              {!useBlocks && estimate.hempcreteVolumeCuFt > 0
                ? ` · ~${Math.round(estimate.hempcreteVolumeCuFt)} cu ft of hempcrete`
                : ""}
            </span>
          )}
        </div>

        {hasResults ? (
          <>
            <ul className="divide-y divide-[var(--border)]">
              {estimate.lines.map((line) => (
                <li key={line.label} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold">{line.label}</div>
                    <div className="text-xs text-muted">{line.detail}</div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <span className="text-accent font-bold">{line.quantity.toLocaleString()}</span>{" "}
                    <span className="text-muted text-sm">{line.unit}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6 text-center">
              <Link href={submitHref} className="btn-primary inline-block py-3 px-8">
                Get matched with vendors for these materials
              </Link>
            </div>
          </>
        ) : (
          <p className="text-muted text-sm">
            Enter your wall dimensions above and the material list will appear here.
          </p>
        )}

        <p className="text-xs text-muted mt-6">
          Planning estimate only (±15–20%), based on typical published hempcrete wall mixes
          (~100 kg hurd, ~150 kg lime binder, ~300 L water per m³ placed) with a 10% waste
          factor. Not engineering quantities — confirm with your installer, binder
          manufacturer, and engineer before ordering.
        </p>
      </div>
    </div>
  );
}
