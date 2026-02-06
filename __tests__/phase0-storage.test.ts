import { describe, it, expect, beforeEach } from "vitest";
import {
  getWelcomeFromStorage,
  setWelcomeInStorage,
  WELCOME_ANSWERS_KEY,
  WELCOME_INTENT_KEY,
  type WelcomeIntent,
} from "@/lib/phase0-storage";

describe("phase0-storage", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(WELCOME_ANSWERS_KEY);
      window.localStorage.removeItem(WELCOME_INTENT_KEY);
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

  it("WELCOME_INTENT_KEY and WELCOME_ANSWERS_KEY are prefixed", () => {
    expect(WELCOME_ANSWERS_KEY.startsWith("ghd_phase0_")).toBe(true);
    expect(WELCOME_INTENT_KEY.startsWith("ghd_phase0_")).toBe(true);
  });
});
