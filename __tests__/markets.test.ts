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
