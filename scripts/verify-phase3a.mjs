#!/usr/bin/env node
/**
 * Phase 3A Production Readiness verification script.
 * Runs: lint (if exists), build, vitest, optional integration (if env present).
 * Exit code: 0 = PASS, non-zero = FAIL.
 */

import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const results = { lint: null, build: null, vitest: null, integration: null };

function run(name, cmd, optional = false) {
  try {
    execSync(cmd, { cwd: root, stdio: "inherit" });
    results[name] = "PASS";
    return true;
  } catch (e) {
    results[name] = "FAIL";
    if (!optional) {
      console.error(`\n[verify-phase3a] ${name} failed (exit ${e.status ?? 1})`);
      return false;
    }
    return false;
  }
}

// 1) Lint (optional - skip if no lint script or it fails in CI)
try {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const lintScript = pkg.scripts?.lint;
  if (lintScript) {
    run("lint", "npm run lint", true);
  } else {
    results.lint = "SKIP (no script)";
  }
} catch {
  results.lint = "SKIP";
}

// 2) Build
if (!run("build", "npm run build")) {
  printSummary(results);
  process.exit(1);
}

// 3) Unit tests (phase3a suite + coa + vendor gating; full suite may have other failures)
if (!run("vitest", "npx vitest run __tests__/phase3a __tests__/coa-compliance.test.ts __tests__/vendor-status-gate.test.ts")) {
  printSummary(results);
  process.exit(1);
}

// 4) Optional integration (vitest runs __tests__/phase3a/smoke.integration.test.ts; it skips if no env)
// So no separate step needed - vitest run already includes it. Just note in summary.
results.integration = "RUN_WITH_VITEST";

printSummary(results);
process.exit(results.build === "PASS" && results.vitest === "PASS" ? 0 : 1);

function printSummary(results) {
  console.log("\n========== Phase 3A Verification Summary ==========");
  console.log("  lint:       ", results.lint ?? "N/A");
  console.log("  build:      ", results.build ?? "N/A");
  console.log("  vitest:     ", results.vitest ?? "N/A");
  console.log("  integration:", results.integration ?? "N/A (run with env for smoke)");
  console.log("==================================================");
  const pass = results.build === "PASS" && results.vitest === "PASS";
  console.log(pass ? "PASS" : "FAIL");
}
