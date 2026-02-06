/**
 * Phase 0: Store welcome/onboarding answers before sign-in.
 * Keys are prefixed so we can attach to profile after sign-in (future wiring).
 * No DB writes in this module.
 */

const PREFIX = "ghd_phase0_";

export const WELCOME_ANSWERS_KEY = `${PREFIX}welcome_answers`;
export const WELCOME_PROFILE_KEY = `${PREFIX}welcome_profile`;

/** @deprecated Use WelcomeProfile.intents instead */
export type WelcomeIntent = "shop" | "sell" | "events" | "explore";

/** @deprecated Use WelcomeProfile instead */
export type WelcomeAnswers = {
  intent?: WelcomeIntent;
  completedAt?: string;
};

export type WelcomeProfile = {
  version: 1;
  intents: string[];
  createdAt: string;
  // Reserved for later phases: role?, interests?, geo?
};

/** All valid intent values for multi-select onboarding */
export const WELCOME_INTENT_OPTIONS = [
  "shop",       // Shop (Buy products)
  "sell",       // Sell (Vendor / Brand)
  "events",     // Events
  "explore",    // Explore (Community / Feed)
  "services",   // Services (Hire / Offer services)
  "drivers",    // Drivers (Logistics)
  "affiliates", // Affiliates
  "business",   // Business (Wholesale / B2B)
  "industrial", // Industrial / Hemp Building
] as const;

export type WelcomeIntentOption = (typeof WELCOME_INTENT_OPTIONS)[number];

export function getWelcomeFromStorage(): WelcomeAnswers | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WELCOME_ANSWERS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WelcomeAnswers;
  } catch {
    return null;
  }
}

export function setWelcomeInStorage(answers: WelcomeAnswers): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WELCOME_ANSWERS_KEY, JSON.stringify({
      ...answers,
      completedAt: answers.completedAt ?? new Date().toISOString(),
    }));
  } catch {
    // ignore
  }
}

// --- Phase 0.5: Multi-select profile ---

function readProfileRaw(): WelcomeProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WELCOME_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { version?: number; intents?: unknown[]; createdAt?: string };
    if (parsed && parsed.version === 1 && Array.isArray(parsed.intents)) {
      return {
        version: 1,
        intents: parsed.intents.filter((x): x is string => typeof x === "string"),
        createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Get the stored welcome profile. Hydration-safe: returns null on server. */
export function getWelcomeProfile(): WelcomeProfile | null {
  return readProfileRaw();
}

/** Merge a partial update into the profile and persist. */
export function setWelcomeProfile(patch: Partial<Pick<WelcomeProfile, "intents">>): void {
  if (typeof window === "undefined") return;
  try {
    const existing = readProfileRaw();
    const now = new Date().toISOString();
    const next: WelcomeProfile = {
      version: 1,
      intents: patch.intents ?? existing?.intents ?? [],
      createdAt: existing?.createdAt ?? now,
    };
    localStorage.setItem(WELCOME_PROFILE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

/** Clear the welcome profile from storage. */
export function clearWelcomeProfile(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(WELCOME_PROFILE_KEY);
  } catch {
    // ignore
  }
}

/** Get intents from stored profile. For feed personalization (Phase 1+). */
export function getWelcomeIntents(): string[] {
  const p = readProfileRaw();
  return p?.intents ?? [];
}
