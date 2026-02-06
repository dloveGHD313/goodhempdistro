import { describe, it, expect, beforeEach } from "vitest";
import {
  getWelcomeFromStorage,
  setWelcomeInStorage,
  WELCOME_ANSWERS_KEY,
  type WelcomeIntent,
} from "@/lib/phase0-storage";

describe("phase0-storage", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(WELCOME_ANSWERS_KEY);
    }
  });

  it("getWelcomeFromStorage returns null when no data", () => {
    expect(getWelcomeFromStorage()).toBeNull();
  });

  it("setWelcomeInStorage then getWelcomeFromStorage round-trips intent", () => {
    setWelcomeInStorage({ intent: "shop" });
    const got = getWelcomeFromStorage();
    expect(got?.intent).toBe("shop");
    expect(got?.completedAt).toBeDefined();
  });

  it("WELCOME_ANSWERS_KEY is prefixed and intent is stored in JSON", () => {
    expect(WELCOME_ANSWERS_KEY.startsWith("ghd_phase0_")).toBe(true);
    setWelcomeInStorage({ intent: "explore" });
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(WELCOME_ANSWERS_KEY) : null;
    expect(raw).toBeTruthy();
    const parsed = raw ? (JSON.parse(raw) as { intent?: string }) : null;
    expect(parsed?.intent).toBe("explore");
  });
});
