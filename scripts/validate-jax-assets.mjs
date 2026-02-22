#!/usr/bin/env node
/**
 * Validate JAX mascot asset pipeline: master exists, outputs exist, sizes reasonable.
 * Usage: npm run check:jax  or  node scripts/validate-jax-assets.mjs
 * Exit: 0 if valid, 1 and message otherwise.
 */

import { existsSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const jaxDir = join(root, "public", "assets", "jax");

const MASTER = "jax-master-base.png";
const OUTPUTS = [
  "jax-hero.png",
  "jax-hero.webp",
  "jax-floating.png",
  "jax-floating.webp",
  "jax-hero@2x.webp",
];

// Reasonable max sizes (bytes): hero can be larger, floating smaller
const MAX_HERO_BYTES = 3 * 1024 * 1024;   // 3 MB
const MAX_FLOATING_BYTES = 600 * 1024;    // 600 KB
const MAX_HERO_2X_BYTES = 5 * 1024 * 1024; // 5 MB

function getSize(filePath) {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}

function main() {
  const masterPath = join(jaxDir, MASTER);
  if (!existsSync(masterPath)) {
    console.error("check:jax — Master missing:", masterPath);
    console.error("Run: npm run generate:jax (after adding jax-master-base.png to public/assets/jax/)");
    process.exit(1);
  }

  const missing = [];
  const oversized = [];

  for (const name of OUTPUTS) {
    const path = join(jaxDir, name);
    if (!existsSync(path)) {
      missing.push(name);
      continue;
    }
    const size = getSize(path);
    if (name.startsWith("jax-hero@2x") && size > MAX_HERO_2X_BYTES) {
      oversized.push({ name, size, max: MAX_HERO_2X_BYTES });
    } else if (name.startsWith("jax-hero") && size > MAX_HERO_BYTES) {
      oversized.push({ name, size, max: MAX_HERO_BYTES });
    } else if (name.startsWith("jax-floating") && size > MAX_FLOATING_BYTES) {
      oversized.push({ name, size, max: MAX_FLOATING_BYTES });
    }
  }

  if (missing.length > 0) {
    console.error("check:jax — Missing output files:", missing.join(", "));
    console.error("Run: npm run generate:jax");
    process.exit(1);
  }

  if (oversized.length > 0) {
    for (const { name, size, max } of oversized) {
      console.error("check:jax — File too large:", name, "(", (size / 1024).toFixed(1), "KB, max", (max / 1024).toFixed(0), "KB)");
    }
    process.exit(1);
  }

  console.log("check:jax — Master and", OUTPUTS.length, "outputs OK; sizes within limits.");
  process.exit(0);
}

main();
