import { describe, expect, it } from "vitest";
import {
  FOUNDING_CAP,
  FOUNDING_PLAN_KEYS,
  FOUNDING_TRIAL_DAYS,
  decodeFoundingCookie,
  foundingFirstChargeDate,
  isFoundingPlanKey,
  normalizeFoundingInterval,
  encodeFoundingCookie,
  formatFoundingNumber,
  foundingSpotsClaimed,
  isFoundingKind,
  normalizeFoundingSource,
} from "@/lib/founding";

describe("founding members helpers", () => {
  it("caps the program at 100", () => {
    expect(FOUNDING_CAP).toBe(100);
  });

  it("formats founding numbers with three digits", () => {
    expect(formatFoundingNumber(1)).toBe("#001");
    expect(formatFoundingNumber(42)).toBe("#042");
    expect(formatFoundingNumber(100)).toBe("#100");
  });

  it("recognises only the two doors", () => {
    expect(isFoundingKind("vendor")).toBe(true);
    expect(isFoundingKind("member")).toBe(true);
    expect(isFoundingKind("admin")).toBe(false);
    expect(isFoundingKind(null)).toBe(false);
  });

  it("sanitises ref sources", () => {
    expect(normalizeFoundingSource(" Insta-Gram_9 ")).toBe("insta-gram_9");
    expect(normalizeFoundingSource("<script>")).toBe("script");
    expect(normalizeFoundingSource("")).toBeNull();
    expect(normalizeFoundingSource(undefined)).toBeNull();
    expect(normalizeFoundingSource("x".repeat(80))?.length).toBe(64);
  });

  it("round-trips the claim cookie", () => {
    expect(decodeFoundingCookie(encodeFoundingCookie("vendor", "email"))).toEqual({ kind: "vendor", source: "email" });
    expect(decodeFoundingCookie(encodeFoundingCookie(null, null))).toEqual({ kind: null, source: null });
    expect(decodeFoundingCookie("bogus|Weird Source!")).toEqual({ kind: null, source: "weirdsource" });
    expect(decodeFoundingCookie("")).toBeNull();
    expect(decodeFoundingCookie(undefined)).toBeNull();
    expect(decodeFoundingCookie("a".repeat(200))).toBeNull();
  });

  it("only the two Enterprise plans qualify", () => {
    expect(isFoundingPlanKey(FOUNDING_PLAN_KEYS.month)).toBe(true);
    expect(isFoundingPlanKey(FOUNDING_PLAN_KEYS.year)).toBe(true);
    expect(isFoundingPlanKey("vendor_starter_monthly")).toBe(false);
    expect(isFoundingPlanKey(undefined)).toBe(false);
  });

  it("normalises billing intervals", () => {
    expect(normalizeFoundingInterval("annual")).toBe("year");
    expect(normalizeFoundingInterval("Yearly")).toBe("year");
    expect(normalizeFoundingInterval("monthly")).toBe("month");
    expect(normalizeFoundingInterval("weekly")).toBeNull();
  });

  it("first charge lands one trial length after the start", () => {
    const start = new Date("2026-09-24T12:00:00Z");
    const first = foundingFirstChargeDate(start);
    expect(FOUNDING_TRIAL_DAYS).toBe(365);
    expect((first.getTime() - start.getTime()) / 86_400_000).toBe(365);
    expect(first.toISOString().slice(0, 10)).toBe("2027-09-24");
  });

  it("derives claimed count from remaining, clamped to the cap", () => {
    expect(foundingSpotsClaimed(100)).toBe(0);
    expect(foundingSpotsClaimed(37)).toBe(63);
    expect(foundingSpotsClaimed(0)).toBe(100);
    expect(foundingSpotsClaimed(-5)).toBe(100);
    expect(foundingSpotsClaimed(500)).toBe(0);
  });
});
