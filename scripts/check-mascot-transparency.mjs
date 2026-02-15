#!/usr/bin/env node
/**
 * Check mascot PNGs for baked-in white matte/halo at edges.
 * Samples border pixels (1px thick); counts visible-but-near-white (R,G,B > 245, alpha > 0).
 * Usage: node scripts/check-mascot-transparency.mjs [file_or_dir]
 * Default: public/brand/ (all mascot*.png)
 * Requires: sharp (devDependency)
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const brandDir = join(root, "public", "brand");

const WHITE_THRESHOLD = 245; // R,G,B >= this = "near white"
const ALPHA_VISIBLE = 10;    // alpha >= this = "visible" pixel

let sharp;
try {
  const mod = await import("sharp");
  sharp = mod.default;
} catch (e) {
  console.error("sharp is required. Run: npm install sharp");
  process.exit(1);
}

function getBorderIndices(width, height) {
  const indices = new Set();
  for (let x = 0; x < width; x++) {
    indices.add(0 * width + x);           // top
    indices.add((height - 1) * width + x); // bottom
  }
  for (let y = 1; y < height - 1; y++) {
    indices.add(y * width + 0);          // left
    indices.add(y * width + (width - 1)); // right
  }
  return indices;
}

async function checkFile(filePath) {
  const buf = readFileSync(filePath);
  const pipeline = sharp(buf).ensureAlpha();
  const meta = await pipeline.metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  if (w === 0 || h === 0) {
    return { file: filePath, error: "Could not get dimensions" };
  }
  const { data } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const channels = meta.channels ?? 4;
  const borderIndices = getBorderIndices(w, h);
  let visible = 0;
  let whiteMatte = 0;
  for (const idx of borderIndices) {
    const i = idx * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = channels >= 4 ? data[i + 3] : 255;
    if (a >= ALPHA_VISIBLE) {
      visible++;
      if (r >= WHITE_THRESHOLD && g >= WHITE_THRESHOLD && b >= WHITE_THRESHOLD) {
        whiteMatte++;
      }
    }
  }
  const pct = visible > 0 ? ((whiteMatte / visible) * 100).toFixed(1) : "0";
  return {
    file: filePath,
    width: w,
    height: h,
    borderPixels: borderIndices.size,
    visibleBorderPixels: visible,
    whiteMatteBorderPixels: whiteMatte,
    pctVisibleThatAreWhite: pct,
    hasHalo: whiteMatte > 0,
  };
}

async function main() {
  const input = process.argv[2] || brandDir;
  let files = [];
  if (existsSync(input)) {
    const stat = await import("fs").then((fs) => fs.promises.stat(input));
    if (stat.isDirectory()) {
      files = readdirSync(input)
        .filter((f) => f.startsWith("mascot") && f.endsWith(".png"))
        .map((f) => join(input, f));
    } else {
      files = [input];
    }
  } else {
    console.error("Path not found:", input);
    process.exit(1);
  }
  if (files.length === 0) {
    console.error("No mascot*.png files found in", input);
    process.exit(1);
  }
  console.log("Checking border pixels (1px edge). Near-white = R,G,B >=", WHITE_THRESHOLD, ", visible = alpha >=", ALPHA_VISIBLE, "\n");
  const results = [];
  for (const f of files.sort()) {
    const r = await checkFile(f);
    results.push(r);
    const name = r.file.replace(/.*[\\/]/, "");
    if (r.error) {
      console.log(name, "—", r.error);
      continue;
    }
    console.log(name);
    console.log("  ", r.width, "x", r.height, "| border visible:", r.visibleBorderPixels, "| near-white at edge:", r.whiteMatteBorderPixels, "(", r.pctVisibleThatAreWhite, "% of visible)");
    console.log("  HALO (baked white matte):", r.hasHalo ? "YES" : "NO");
    console.log("");
  }
  const withHalo = results.filter((r) => r.hasHalo && !r.error);
  if (withHalo.length > 0) {
    console.log("---");
    console.log("CONCLUSION: Baked halo detected in:", withHalo.map((r) => r.file.replace(/.*[\\/]/, "")).join(", "));
    console.log("Replace public/brand/mascot.png with a clean transparent cutout, then run: npm run generate:mascot-assets");
    process.exitCode = 1;
  } else {
    console.log("---");
    console.log("CONCLUSION: No baked white matte detected at borders (or no visible border pixels).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
