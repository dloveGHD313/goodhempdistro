#!/usr/bin/env node
/**
 * Generate per-surface mascot assets from a single source PNG.
 * Usage: node scripts/generate-mascot-assets.mjs [source.png]
 * Default source: public/brand/mascot.png
 * Outputs to public/brand/: mascot-hero.png, mascot-avatar.png, mascot-icon.png,
 *   mascot-watermark.png, mascot-social.png
 * Requires: npm install sharp (devDependency)
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from "fs";
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
// Padding for normalized master so 1px border stays empty (halo check passes).
const MASTER_PAD_PX = 10;

function trimWhite(pipe, useEdgeCleanup = true) {
  const threshold = useEdgeCleanup ? TRIM_EDGE_CLEANUP : TRIM_THRESHOLD;
  try {
    return pipe.trim({ threshold });
  } catch {
    return pipe;
  }
}

/** On first run only, backup master to mascot.original.png if it does not exist. */
async function ensureBackupOriginal(masterPath) {
  const backupPath = join(outDir, "mascot.original.png");
  if (!existsSync(backupPath)) {
    copyFileSync(masterPath, backupPath);
  }
}

/** Set RGB to 0 for every pixel where alpha === 0; return new sharp instance from raw. */
async function dematteTransparentPixels(sharpInstance) {
  const { data, info } = await sharpInstance
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) {
      data[i + 0] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
}

/** Trim, dematte, add transparent padding; return PNG buffer for master. */
async function normalizeMasterToTransparentSafeBorder(inputBuf, padPx) {
  let pipe = sharp(inputBuf).ensureAlpha();
  pipe = trimWhite(pipe);
  pipe = await dematteTransparentPixels(pipe);
  pipe = pipe.extend({
    top: padPx,
    bottom: padPx,
    left: padPx,
    right: padPx,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  const normalizedBuf = await pipe.png().toBuffer();
  const normalizedMeta = await sharp(normalizedBuf).metadata();
  return { normalizedBuf, normalizedMeta };
}

/**
 * De-matte fully transparent pixels (set RGB to 0 when alpha === 0) and add
 * a transparent safe border so the 1px edge has no visible pixels (halo check passes).
 */
async function dematteAndPad(inputSharp, padPx = 6) {
  const { data, info } = await inputSharp
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) {
      data[i + 0] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    }
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extend({
      top: padPx,
      bottom: padPx,
      left: padPx,
      right: padPx,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
}

async function run() {
  const masterPath = join(outDir, "mascot.png");
  const originalMasterBuf = readFileSync(masterPath);

  await ensureBackupOriginal(masterPath);

  const { normalizedBuf, normalizedMeta } = await normalizeMasterToTransparentSafeBorder(originalMasterBuf, MASTER_PAD_PX);
  writeFileSync(masterPath, normalizedBuf);
  console.log("Normalized master wrote mascot.png (backup: mascot.original.png)");

  const buf = normalizedBuf;
  const meta = normalizedMeta;
  console.log("Source:", masterPath, "| size:", meta.width, "x", meta.height);

  // 1) mascot-hero.png — welcome hero, large, transparent, tightly cropped
  const heroSafe = await dematteAndPad(trimWhite(sharp(buf).clone()), 6);
  await heroSafe
    .resize({ width: 600, fit: "inside", withoutEnlargement: true })
    .png()
    .toFile(join(outDir, "mascot-hero.png"));
  console.log("Wrote mascot-hero.png");

  // 2) mascot-avatar.png — Ask JAX floating chat avatar, head/shoulders
  const avatarSafe = await dematteAndPad(trimWhite(sharp(buf).clone()), 6);
  await avatarSafe
    .resize({ width: 384, height: 384, fit: "cover", position: "top" })
    .png()
    .toFile(join(outDir, "mascot-avatar.png"));
  console.log("Wrote mascot-avatar.png");

  // 3) mascot-icon.png — small square icon ~512x512
  const iconSafe = await dematteAndPad(trimWhite(sharp(buf).clone()), 6);
  await iconSafe
    .resize({ width: 512, height: 512, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(outDir, "mascot-icon.png"));
  console.log("Wrote mascot-icon.png");

  // 4) mascot-watermark.png — watermark background, tightly cropped (opacity via CSS)
  const watermarkSafe = await dematteAndPad(trimWhite(sharp(buf).clone()), 6);
  await watermarkSafe
    .resize({ width: 420, fit: "inside", withoutEnlargement: true })
    .png()
    .toFile(join(outDir, "mascot-watermark.png"));
  console.log("Wrote mascot-watermark.png");

  // 5) mascot-social.png — 1024x1024 square social thumbnail
  const socialSafe = await dematteAndPad(trimWhite(sharp(buf).clone()), 6);
  await socialSafe
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
