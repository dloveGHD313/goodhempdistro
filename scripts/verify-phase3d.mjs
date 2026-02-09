#!/usr/bin/env node
/**
 * Phase 3D verification script.
 * Runs: build, vitest (phase3d + phase3a + phase3c).
 * Exit code: 0 = PASS, non-zero = FAIL.
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const results = { build: null, vitest: null };

function run(name, cmd) {
  try {
    execSync(cmd, { cwd: root, stdio: "inherit" });
    results[name] = "PASS";
    return true;
  } catch (e) {
    results[name] = "FAIL";
    console.error(`\n[verify-phase3d] ${name} failed (exit ${e.status ?? 1})`);
    return false;
  }
}

if (!run("build", "npm run build")) {
  printSummary(results);
  process.exit(1);
}

if (
  !run(
    "vitest",
    "npx vitest run __tests__/phase3d __tests__/phase3a __tests__/phase3c"
  )
) {
  printSummary(results);
  process.exit(1);
}

printSummary(results);
process.exit(results.build === "PASS" && results.vitest === "PASS" ? 0 : 1);

function printSummary(results) {
  console.log("\n========== Phase 3D Verification Summary ==========");
  console.log("  build:      ", results.build ?? "N/A");
  console.log("  vitest:     ", results.vitest ?? "N/A");
  console.log("==================================================");
  const pass = results.build === "PASS" && results.vitest === "PASS";
  console.log(pass ? "PASS" : "FAIL");
}

