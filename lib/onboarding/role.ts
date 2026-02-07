/**
 * Phase 1.5: Derive primary role from welcome_intents for questionnaire tailoring.
 * Priority: sell > drivers > industrial > events > services > affiliates > default consumer.
 */

export type OnboardingRole =
  | "vendor"
  | "consumer"
  | "driver"
  | "affiliate"
  | "industrial";

const INTENT_PRIORITY: [string, OnboardingRole][] = [
  ["sell", "vendor"],
  ["drivers", "driver"],
  ["industrial", "industrial"],
  ["events", "vendor"],
  ["services", "vendor"],
  ["affiliates", "affiliate"],
  ["business", "consumer"],
  ["shop", "consumer"],
  ["explore", "consumer"],
];

/**
 * Compute primary role from welcome intents array.
 * Uses first match in priority order.
 */
export function computeRoleFromWelcomeIntents(intents: string[] | null | undefined): OnboardingRole {
  if (!Array.isArray(intents) || intents.length === 0) {
    return "consumer";
  }

  const normalized = new Set(intents.map((s) => String(s).toLowerCase().trim()));

  for (const [intent, role] of INTENT_PRIORITY) {
    if (normalized.has(intent)) return role;
  }

  return "consumer";
}
