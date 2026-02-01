import { describe, it, expect } from "vitest";
import {
  normalizeMarket,
  isRecreationalCategory,
  getMarketDisplayName,
  RECREATIONAL,
  MARKET_DISPLAY_NAMES,
} from "@/lib/markets";

describe("normalizeMarket", () => {
  it("maps intoxicating to recreational", () => {
    expect(normalizeMarket("intoxicating")).toBe(RECREATIONAL);
    expect(normalizeMarket("INTOXICATING")).toBe(RECREATIONAL);
  });

  it("maps psychoactive to recreational", () => {
    expect(normalizeMarket("psychoactive")).toBe(RECREATIONAL);
    expect(normalizeMarket("PSYCHOACTIVE")).toBe(RECREATIONAL);
  });

  it("maps intoxicated to recreational", () => {
    expect(normalizeMarket("intoxicated")).toBe(RECREATIONAL);
    expect(normalizeMarket("INTOXICATED")).toBe(RECREATIONAL);
  });

  it("returns RECREATIONAL for recreational", () => {
    expect(normalizeMarket("RECREATIONAL")).toBe(RECREATIONAL);
    expect(normalizeMarket("recreational")).toBe(RECREATIONAL);
  });

  it("returns other valid markets as-is", () => {
    expect(normalizeMarket("CBD_WELLNESS")).toBe("CBD_WELLNESS");
    expect(normalizeMarket("INDUSTRIAL")).toBe("INDUSTRIAL");
    expect(normalizeMarket("SERVICES")).toBe("SERVICES");
  });

  it("returns null for null/empty/unknown", () => {
    expect(normalizeMarket(null)).toBeNull();
    expect(normalizeMarket(undefined)).toBeNull();
    expect(normalizeMarket("")).toBeNull();
    expect(normalizeMarket("  ")).toBeNull();
    expect(normalizeMarket("unknown")).toBeNull();
  });
});

describe("isRecreationalCategory", () => {
  it("returns true for recreational/intoxicating/psychoactive", () => {
    expect(isRecreationalCategory("RECREATIONAL")).toBe(true);
    expect(isRecreationalCategory("INTOXICATING")).toBe(true);
    expect(isRecreationalCategory("intoxicating")).toBe(true);
    expect(isRecreationalCategory("psychoactive")).toBe(true);
  });

  it("returns false for other markets", () => {
    expect(isRecreationalCategory("CBD_WELLNESS")).toBe(false);
    expect(isRecreationalCategory("INDUSTRIAL")).toBe(false);
    expect(isRecreationalCategory(null)).toBe(false);
  });
});

describe("getMarketDisplayName", () => {
  it("returns Recreational for recreational/intoxicating", () => {
    expect(getMarketDisplayName("RECREATIONAL")).toBe("Recreational");
    expect(getMarketDisplayName("INTOXICATING")).toBe("Recreational");
    expect(getMarketDisplayName("intoxicating")).toBe("Recreational");
  });

  it("returns correct labels for other markets", () => {
    expect(getMarketDisplayName("CBD_WELLNESS")).toBe("CBD & Wellness");
    expect(getMarketDisplayName("INDUSTRIAL")).toBe("Industrial");
    expect(getMarketDisplayName("SERVICES")).toBe("Services");
  });
});

describe("MARKET_DISPLAY_NAMES", () => {
  it("must not expose Intoxicating/Intoxicated/Psychoactive in UI", () => {
    const labels = Object.values(MARKET_DISPLAY_NAMES);
    expect(labels.some((l) => /intoxicating/i.test(l))).toBe(false);
    expect(labels.some((l) => /intoxicated/i.test(l))).toBe(false);
    expect(labels.some((l) => /psychoactive/i.test(l))).toBe(false);
    expect(labels).toContain("Recreational");
  });
});

/** UI guardrail: no renderable copy may contain legacy words. */
const FORBIDDEN_UI_WORDS = ["Intoxicating", "Intoxicated", "Psychoactive"] as const;
/** Allowed only when part of identifier (e.g. getIntoxicatingCutoffDate) or DB column/value. */
const ALLOWED_PATTERNS = /getIntoxicating|isIntoxicating|intoxicating_policy|intoxicating_ack|value=["']intoxicating["']/;

describe("UI must not render Intoxicating/Intoxicated/Psychoactive", () => {
  it("no app or components .tsx file contains legacy words in user-facing copy", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const root = path.join(process.cwd());
    const dirs = [path.join(root, "app"), path.join(root, "components")];
    const violations: { file: string; word: string; line: number }[] = [];

    function scanDir(dir: string) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== "node_modules" && e.name !== "__tests__") scanDir(full);
        } else if (e.name.endsWith(".tsx")) {
          const content = fs.readFileSync(full, "utf8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const isAllowed = ALLOWED_PATTERNS.test(line);
            if (isAllowed) continue;
            for (const word of FORBIDDEN_UI_WORDS) {
              if (line.includes(word)) {
                violations.push({ file: full.replace(root, ""), word, line: i + 1 });
              }
            }
          }
        }
      }
    }
    for (const d of dirs) scanDir(d);

    expect(
      violations,
      violations.length
        ? `UI must not render Intoxicating/Intoxicated/Psychoactive. Found: ${JSON.stringify(violations)}`
        : undefined
    ).toHaveLength(0);
  });
});
