// compliance-scan.mjs
import fs from "fs";
import path from "path";
import { URL } from "url";

const BASE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"));
const PAGES_DIR = path.join(BASE, "pages");
const OUT = path.join(BASE, "compliance", "compliance-report.txt");

const KEYWORDS = [
  { key: "FDA", pattern: /\bFDA\b/gi },
  { key: "not intended to diagnose", pattern: /not intended to diagnose/gi },
  { key: "consult a physician", pattern: /consult a physician/gi },
  { key: "THC", pattern: /\bTHC\b/gi },
  { key: "Delta-9", pattern: /delta.?9/gi },
  { key: "Delta-8", pattern: /delta.?8/gi },
  { key: "21+", pattern: /21\+|21 and (over|older)|must be 21/gi },
  { key: "age verification / age-gate", pattern: /age.?(verif|gate|confirm|check)/gi },
  { key: "lab test", pattern: /lab.?test/gi },
  { key: "COA / certificate of analysis", pattern: /\bCOA\b|certificate of analysis/gi },
  { key: "terms", pattern: /terms of service|terms and conditions/gi },
  { key: "privacy", pattern: /privacy policy/gi },
  { key: "refund", pattern: /refund policy|refund/gi },
  { key: "shipping", pattern: /shipping policy|free shipping|delivery time/gi },
];

const slugDirs = fs.readdirSync(PAGES_DIR).filter(d => fs.statSync(path.join(PAGES_DIR, d)).isDirectory());

const findings = {};
for (const k of KEYWORDS) findings[k.key] = [];

for (const slug of slugDirs) {
  const cleanPath = path.join(PAGES_DIR, slug, "clean-text.txt");
  if (!fs.existsSync(cleanPath)) continue;
  
  const statusPath = path.join(PAGES_DIR, slug, "status.json");
  let url = `https://www.goodhempdistro.com/${slug === "root" ? "" : slug.replace(/_/g, "/")}`;
  if (fs.existsSync(statusPath)) {
    try { const s = JSON.parse(fs.readFileSync(statusPath, "utf8")); url = s.url || url; } catch {}
  }
  
  const text = fs.readFileSync(cleanPath, "utf8");
  const lines = text.split("\n");
  
  for (const { key, pattern } of KEYWORDS) {
    for (let i = 0; i < lines.length; i++) {
      pattern.lastIndex = 0;
      if (pattern.test(lines[i])) {
        const snippet = lines.slice(Math.max(0, i - 1), i + 2).join(" ").trim().slice(0, 200);
        findings[key].push({ url, line: i + 1, snippet });
      }
    }
  }
}

// Build report
let report = `GOOD HEMP DISTRO — COMPLIANCE KEYWORD SCAN\n`;
report += `Generated: 2026-03-02\n`;
report += `Method: Full-text scan of clean-text.txt across all ${slugDirs.length} captured pages\n`;
report += `Keywords scanned: ${KEYWORDS.length}\n\n`;
report += "=".repeat(60) + "\n\n";

for (const { key } of KEYWORDS) {
  const hits = findings[key];
  if (hits.length === 0) {
    report += `NOT FOUND: ${key}\n\n`;
  } else {
    report += `FOUND: ${key} — ${hits.length} occurrence(s)\n`;
    const byUrl = {};
    for (const h of hits) {
      if (!byUrl[h.url]) byUrl[h.url] = [];
      byUrl[h.url].push(h);
    }
    for (const [url, entries] of Object.entries(byUrl)) {
      report += `  URL: ${url}\n`;
      const shown = entries.slice(0, 3);
      for (const e of shown) {
        report += `    Line ${e.line}: "${e.snippet.replace(/\n/g, " ").slice(0, 150)}"\n`;
      }
      if (entries.length > 3) report += `    ... and ${entries.length - 3} more occurrence(s)\n`;
    }
    report += "\n";
  }
}

fs.mkdirSync(path.join(BASE, "compliance"), { recursive: true });
fs.writeFileSync(OUT, report, "utf8");
console.log("Compliance report written:", OUT);
console.log("\nSummary:");
for (const { key } of KEYWORDS) {
  const c = findings[key].length;
  console.log(`  ${c > 0 ? "FOUND" : "NOT FOUND"} (${c}): ${key}`);
}
