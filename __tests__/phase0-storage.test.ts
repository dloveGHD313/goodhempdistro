import { describe, it, expect, beforeEach } from "vitest";
import {
  getWelcomeFromStorage,
  setWelcomeInStorage,
  WELCOME_ANSWERS_KEY,
  WELCOME_PROFILE_KEY,
  getWelcomeProfile,
  setWelcomeProfile,
  clearWelcomeProfile,
  getWelcomeIntents,
  type WelcomeIntent,
} from "@/lib/phase0-storage";

describe("phase0-storage", () => {
  beforeEach(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(WELCOME_ANSWERS_KEY);
      window.localStorage.removeItem(WELCOME_PROFILE_KEY);
    }
  });

  describe("legacy WelcomeAnswers", () => {
    it("getWelcomeFromStorage returns null when no data", () => {
      expect(getWelcomeFromStorage()).toBeNull();
    });

    it("setWelcomeInStorage then getWelcomeFromStorage round-trips intent", () => {
      setWelcomeInStorage({ intent: "shop" as WelcomeIntent });
      const got = getWelcomeFromStorage();
      expect(got?.intent).toBe("shop");
      expect(got?.completedAt).toBeDefined();
    });

    it("WELCOME_ANSWERS_KEY is prefixed and intent is stored in JSON", () => {
      expect(WELCOME_ANSWERS_KEY.startsWith("ghd_phase0_")).toBe(true);
      setWelcomeInStorage({ intent: "explore" as WelcomeIntent });
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(WELCOME_ANSWERS_KEY) : null;
      expect(raw).toBeTruthy();
      const parsed = raw ? (JSON.parse(raw) as { intent?: string }) : null;
      expect(parsed?.intent).toBe("explore");
    });
  });

  describe("Phase 0.5 WelcomeProfile (multi-select)", () => {
    it("getWelcomeProfile returns null when no data", () => {
      expect(getWelcomeProfile()).toBeNull();
      expect(getWelcomeIntents()).toEqual([]);
    });

    it("setWelcomeProfile persists multi-select intents", () => {
      setWelcomeProfile({ intents: ["shop", "sell", "events"] });
      const p = getWelcomeProfile();
      expect(p).not.toBeNull();
      expect(p?.version).toBe(1);
      expect(p?.intents).toEqual(["shop", "sell", "events"]);
      expect(p?.createdAt).toBeDefined();
      expect(getWelcomeIntents()).toEqual(["shop", "sell", "events"]);
    });

    it("setWelcomeProfile merges with existing profile", () => {
      setWelcomeProfile({ intents: ["shop"] });
      const created = getWelcomeProfile()?.createdAt;
      setWelcomeProfile({ intents: ["shop", "explore"] });
      const p = getWelcomeProfile();
      expect(p?.intents).toEqual(["shop", "explore"]);
      expect(p?.createdAt).toBe(created);
    });

    it("clearWelcomeProfile removes profile from storage", () => {
      setWelcomeProfile({ intents: ["shop"] });
      expect(getWelcomeProfile()).not.toBeNull();
      clearWelcomeProfile();
      expect(getWelcomeProfile()).toBeNull();
      expect(getWelcomeIntents()).toEqual([]);
    });

    it("WELCOME_PROFILE_KEY is prefixed", () => {
      expect(WELCOME_PROFILE_KEY.startsWith("ghd_phase0_")).toBe(true);
    });

    it("getWelcomeIntents returns empty array when profile missing", () => {
      expect(getWelcomeIntents()).toEqual([]);
    });
  });
});
