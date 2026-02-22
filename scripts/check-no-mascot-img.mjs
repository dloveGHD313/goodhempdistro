#!/usr/bin/env node
/**
 * Regression guardrail: fail if any mascot asset is rendered with <img> instead of next/image.
 * Scans components/ and app/ for lines containing '<img' and mascot asset paths.
 * Usage: node scripts/check-no-mascot-img.mjs
 * Exit: 0 if none found, 1 and print offending files/lines otherwise.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const root = join(fileURLToPath(import.meta.url), "..", "..");

const MASCOT_PATTERNS = [
  "/brand/mascot",
  "mascot-hero",
  "mascot-avatar",
  "mascot-icon",
  "mascot-watermark",
  "mascot-social",
  "mascot.png",
  "/assets/jax",
  "jax-hero",
  "jax-floating",
];

function hasMascotRef(line) {
  return MASCOT_PATTERNS.some((p) => line.includes(p));
}

function hasImgTag(line) {
  return /<img\s/.test(line) || line.trimStart().startsWith("<img");
}

function* walkDir(dir, base = dir) {
  if (!dir.startsWith(base)) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      yield* walkDir(full, base);
    } else if (e.isFile() && /\.(tsx?|jsx?|mjs)$/.test(e.name)) {
      yield full;
    }
  }
}

function checkFile(filePath) {
  const lines = readFileSync(filePath, "utf8").split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (hasImgTag(line) && hasMascotRef(line)) {
      hits.push({ lineNum: i + 1, content: line.trim() });
    }
  }
  return hits;
}

const dirs = [join(root, "components"), join(root, "app")];
const offenders = [];

for (const dir of dirs) {
  try {
    statSync(dir);
  } catch {
    continue;
  }
  for (const file of walkDir(dir)) {
    const hits = checkFile(file);
    if (hits.length) {
      offenders.push({ file, hits });
    }
  }
}

if (offenders.length > 0) {
  console.error("check-no-mascot-img: mascot assets must use next/image, not <img>.\n");
  for (const { file, hits } of offenders) {
    console.error(file);
    for (const { lineNum, content } of hits) {
      console.error(`  ${lineNum}: ${content}`);
    }
    console.error("");
  }
  process.exit(1);
}

console.log("check-no-mascot-img: no <img> mascot usage found (OK).");
process.exit(0);
