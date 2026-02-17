#!/usr/bin/env node
/**
 * Design-system guardrail: warn if key hero surfaces use raw btn-* classes
 * instead of components/ui/Button. Scans app/welcome and app/newsfeed.
 * Usage: node scripts/check-ui-regressions.mjs
 * Exit: 0 always (advisory); prints warnings if raw btn-primary/btn-secondary found.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const root = join(fileURLToPath(import.meta.url), "..", "..");

const KEY_FILES = [
  "app/welcome/WelcomeClient.tsx",
  "app/newsfeed/FeedExperience.tsx",
];

const RAW_BTN_PATTERN = /className="[^"]*btn-(primary|secondary|ghost)/;
const BUTTON_IMPORT = /from\s+["']@\/components\/ui\/Button["']/;

let warned = false;

for (const rel of KEY_FILES) {
  const path = join(root, rel);
  if (!existsSync(path)) continue;
  const content = readFileSync(path, "utf8");
  const hasButtonImport = BUTTON_IMPORT.test(content);
  const rawMatch = content.match(RAW_BTN_PATTERN);
  if (rawMatch && !hasButtonImport) {
    console.warn(`check:ui-regressions: ${rel} uses raw btn-* class (consider components/ui/Button).`);
    warned = true;
  }
  if (rawMatch && hasButtonImport) {
    console.warn(`check:ui-regressions: ${rel} has both Button import and raw btn-* (prefer Button for CTAs).`);
    warned = true;
  }
}

if (!warned) {
  console.log("check:ui-regressions: key surfaces OK (no raw btn-* in welcome/feed hero).");
}

process.exit(0);
