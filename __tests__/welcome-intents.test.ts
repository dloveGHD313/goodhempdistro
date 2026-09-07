import { describe, expect, it } from "vitest";
import { WELCOME_INTENT_OPTIONS } from "@/lib/phase0-storage";
import { computeRoleFromWelcomeIntents } from "@/lib/onboarding/role";
import {
  jaxLineFor,
  primaryIntent,
  signupRoleFor,
  welcomeIntentCards,
  welcomeIntentKeys,
} from "@/lib/welcomeIntents";

describe("welcomeIntents (Phase 0 boot sequence)", () => {
  it("offers exactly the nine roadmap intents, matching phase0-storage", () => {
    expect(welcomeIntentKeys).toHaveLength(9);
    expect([...welcomeIntentKeys].sort()).toEqual([...WELCOME_INTENT_OPTIONS].sort());
    expect(new Set(welcomeIntentKeys).size).toBe(9);
  });

  it("every card has copy and a JAX line", () => {
    for (const c of welcomeIntentCards) {
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.sub.length).toBeGreaterThan(0);
      expect(c.jaxLine.length).toBeGreaterThan(10);
    }
  });

  it("JAX asks the question when nothing is selected", () => {
    expect(jaxLineFor([])).toMatch(/pick/i);
  });

  it("JAX reacts to the most recent toggle and changes the micro-script by role", () => {
    expect(jaxLineFor(["sell"], "sell")).toMatch(/founding vendors/i);
    expect(jaxLineFor(["shop", "drivers"], "drivers")).toMatch(/on-demand/i);
    // deselecting the last toggled falls back to the last remaining pick
    expect(jaxLineFor(["industrial"], "shop")).toMatch(/building/i);
  });

  it("acknowledges a full combo once three or more are picked", () => {
    expect(jaxLineFor(["shop", "sell", "events"], "events")).toMatch(/let's do it/i);
  });

  it("primary intent follows the onboarding role priority", () => {
    expect(primaryIntent(["shop", "sell"])).toBe("sell");
    expect(primaryIntent(["explore", "drivers", "affiliates"])).toBe("drivers");
    expect(primaryIntent(["explore"])).toBe("explore");
    expect(primaryIntent([])).toBeNull();
    // stays consistent with lib/onboarding/role.ts
    expect(computeRoleFromWelcomeIntents(["shop", "sell"])).toBe("vendor");
    expect(computeRoleFromWelcomeIntents(["explore", "drivers"])).toBe("driver");
  });

  it("maps the primary intent to a signup role hint", () => {
    expect(signupRoleFor(["sell"])).toBe("vendor");
    expect(signupRoleFor(["industrial"])).toBe("vendor");
    expect(signupRoleFor(["drivers", "shop"])).toBe("driver");
    expect(signupRoleFor(["affiliates"])).toBe("affiliate");
    expect(signupRoleFor(["shop", "business"])).toBe("consumer");
    expect(signupRoleFor([])).toBeNull();
  });
});
