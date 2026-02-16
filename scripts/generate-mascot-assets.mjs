#!/usr/bin/env node
/**
 * Generate per-surface mascot assets from a single source PNG.
 * Usage: node scripts/generate-mascot-assets.mjs [source.png]
 * Default source: public/brand/mascot.png
 * Outputs to public/brand/: mascot-hero.png, mascot-avatar.png, mascot-icon.png,
 *   mascot-watermark.png, mascot-social.png
 * Requires: npm install sharp (devDependency)
 */

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const defaultSource = join(root, "public", "brand", "mascot.png");
const outDir = join(root, "public", "brand");

const source = process.argv[2] || defaultSource;

if (!existsSync(source)) {
  console.error("Source image not found:", source);
  process.exit(1);
}

let sharp;
try {
  const mod = await import("sharp");
  sharp = mod.default;
} catch (e) {
  console.error("sharp is required. Run: npm install sharp");
  process.exit(1);
}

// Trim near-white borders (0-255). Higher = more aggressive; reduces halo at edges.
const TRIM_THRESHOLD = 12;
// Stronger trim for edge cleanup: removes more baked matte before resize (minimal defringe).
const TRIM_EDGE_CLEANUP = 24;

function trimWhite(pipe, useEdgeCleanup = true) {
  const threshold = useEdgeCleanup ? TRIM_EDGE_CLEANUP : TRIM_THRESHOLD;
  try {
    return pipe.trim({ threshold });
  } catch {
    return pipe;
  }
}

async function run() {
  const buf = readFileSync(source);
  const image = sharp(buf);
  const meta = await image.metadata();
  console.log("Source:", source, "| size:", meta.width, "x", meta.height);

  // 1) mascot-hero.png — welcome hero, large, transparent, tightly cropped
  await trimWhite(sharp(buf).clone())
    .resize({ width: 600, fit: "inside", withoutEnlargement: true })
    .png()
    .toFile(join(outDir, "mascot-hero.png"));
  console.log("Wrote mascot-hero.png");

  // 2) mascot-avatar.png — Ask JAX floating chat avatar, head/shoulders
  await trimWhite(sharp(buf).clone())
    .resize({ width: 384, height: 384, fit: "cover", position: "top" })
    .png()
    .toFile(join(outDir, "mascot-avatar.png"));
  console.log("Wrote mascot-avatar.png");

  // 3) mascot-icon.png — small square icon ~512x512
  await trimWhite(sharp(buf).clone())
    .resize({ width: 512, height: 512, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(outDir, "mascot-icon.png"));
  console.log("Wrote mascot-icon.png");

  // 4) mascot-watermark.png — watermark background, tightly cropped (opacity via CSS)
  await trimWhite(sharp(buf).clone())
    .resize({ width: 420, fit: "inside", withoutEnlargement: true })
    .png()
    .toFile(join(outDir, "mascot-watermark.png"));
  console.log("Wrote mascot-watermark.png");

  // 5) mascot-social.png — 1024x1024 square social thumbnail
  await trimWhite(sharp(buf).clone())
    .resize({ width: 1024, height: 1024, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(outDir, "mascot-social.png"));
  console.log("Wrote mascot-social.png");

  console.log("Done. All assets in public/brand/");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
