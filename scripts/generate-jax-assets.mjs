#!/usr/bin/env node
/**
 * Single JAX mascot asset pipeline. Generates web-ready derivatives from the master.
 * Master: public/assets/jax/jax-master-base.png (REQUIRED).
 * Outputs (all in public/assets/jax/):
 *   jax-hero.png, jax-hero.webp (1800×1800, contain)
 *   jax-floating.png, jax-floating.webp (512×512, contain)
 *   jax-hero@2x.webp (2400×2400, contain) optional
 * Usage: npm run generate:jax  or  node scripts/generate-jax-assets.mjs
 * Requires: sharp (devDependency)
 */

import { readFileSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const jaxDir = join(root, "public", "assets", "jax");
const MASTER_PATH = join(jaxDir, "jax-master-base.png");

const TRIM_THRESHOLD = 24;
const PAD_PX = 6;
const WEBP_QUALITY = 90;

let sharp;
try {
  const mod = await import("sharp");
  sharp = mod.default;
} catch (e) {
  console.error("sharp is required. Run: npm install sharp");
  process.exit(1);
}

if (!existsSync(MASTER_PATH)) {
  console.error("JAX master asset missing:", MASTER_PATH);
  console.error("Add jax-master-base.png to public/assets/jax/ and run again.");
  process.exit(1);
}

function trimWhite(pipe) {
  try {
    return pipe.trim({ threshold: TRIM_THRESHOLD });
  } catch {
    return pipe;
  }
}

async function dematteAndPad(inputSharp, padPx = PAD_PX) {
  const { data, info } = await inputSharp
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) {
      data[i] = 0;
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
  const inputBuf = readFileSync(MASTER_PATH);
  let pipe = sharp(inputBuf).ensureAlpha();
  pipe = trimWhite(pipe);
  const prepared = await dematteAndPad(pipe);

  if (!existsSync(jaxDir)) {
    mkdirSync(jaxDir, { recursive: true });
  }

  const containBg = { r: 0, g: 0, b: 0, alpha: 0 };

  // jax-hero: 1800×1800 contain
  const heroBuf = await prepared.clone()
    .resize(1800, 1800, { fit: "contain", background: containBg })
    .png()
    .toBuffer();
  await sharp(heroBuf).png().toFile(join(jaxDir, "jax-hero.png"));
  console.log("Wrote jax-hero.png (1800×1800)");
  await sharp(heroBuf).webp({ quality: WEBP_QUALITY }).toFile(join(jaxDir, "jax-hero.webp"));
  console.log("Wrote jax-hero.webp (1800×1800, quality " + WEBP_QUALITY + ")");

  // jax-floating: 512×512 contain (avatar / widget / onboarding icon)
  const floatingBuf = await prepared.clone()
    .resize(512, 512, { fit: "contain", background: containBg })
    .png()
    .toBuffer();
  await sharp(floatingBuf).png().toFile(join(jaxDir, "jax-floating.png"));
  console.log("Wrote jax-floating.png (512×512)");
  await sharp(floatingBuf).webp({ quality: WEBP_QUALITY }).toFile(join(jaxDir, "jax-floating.webp"));
  console.log("Wrote jax-floating.webp (512×512, quality " + WEBP_QUALITY + ")");

  // Optional: jax-hero@2x.webp 2400×2400
  await prepared.clone()
    .resize(2400, 2400, { fit: "contain", background: containBg })
    .webp({ quality: WEBP_QUALITY })
    .toFile(join(jaxDir, "jax-hero@2x.webp"));
  console.log("Wrote jax-hero@2x.webp (2400×2400)");

  console.log("");
  console.log("JAX assets generated successfully in public/assets/jax/");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
