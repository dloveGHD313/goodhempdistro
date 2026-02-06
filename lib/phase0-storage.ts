/**
 * Phase 0: Store welcome/onboarding answers before sign-in.
 * Keys are prefixed so we can attach to profile after sign-in (future wiring).
 * No DB writes in this module.
 */

const PREFIX = "ghd_phase0_";

export const WELCOME_INTENT_KEY = `${PREFIX}welcome_intent`;
export const WELCOME_ANSWERS_KEY = `${PREFIX}welcome_answers`;

export type WelcomeIntent = "shop" | "sell" | "events" | "explore";

export type WelcomeAnswers = {
  intent?: WelcomeIntent;
  completedAt?: string; // ISO
};

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
