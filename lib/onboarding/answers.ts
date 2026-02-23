/**
 * Shared onboarding answer lookup. Handles both unprefixed keys (consumer_use_type)
 * and prefixed keys (consumer_consumer_use_type) from multi-role flows like GetStartedClient.
 */

export type OnboardingAnswers = Record<string, string | string[] | undefined>;

function normalizeString(value: string | string[] | undefined): string | undefined {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === "string" && v.trim() !== "");
    return first != null ? first.trim() : undefined;
  }
  const s = String(value).trim();
  return s === "" ? undefined : s;
}

/**
 * Returns the first non-empty string value for any of the given keys (trimmed).
 * Handles string or string[] values.
 */
export function getAnswer(
  answers: OnboardingAnswers | undefined,
  keys: string[]
): string | undefined {
  if (!answers || !Array.isArray(keys)) return undefined;
  for (const key of keys) {
    const value = answers[key];
    const out = normalizeString(value);
    if (out !== undefined) return out;
  }
  return undefined;
}

/**
 * Tries keys in order: ${role}_${id}, ${id}, ${role}_${role}_${id}, then defensive scan
 * for any key starting with role_ and ending with _${id} (handles triple-prefix etc).
 * Returns normalized string or undefined.
 */
export function getRoleAnswer(
  answers: OnboardingAnswers | undefined,
  role: string,
  id: string
): string | undefined {
  if (!answers) return undefined;
  const prefixed = `${role}_${id}`;
  const doublePrefixed = `${role}_${role}_${id}`;
  const value = answers[prefixed] ?? answers[id] ?? answers[doublePrefixed];
  if (value !== undefined && value !== null) return normalizeString(value);
  const suffix = `_${id}`;
  for (const key of Object.keys(answers)) {
    if (key.startsWith(`${role}_`) && key.endsWith(suffix)) {
      const v = answers[key];
      const out = normalizeString(v);
      if (out !== undefined) return out;
    }
  }
  return undefined;
}

/** Keys to try for consumer use type (personal vs business/wholesale). */
export const CONSUMER_USE_TYPE_KEYS = [
  "consumer_consumer_use_type",
  "consumer_use_type",
  "use_type",
] as const;

/**
 * Resolves consumer use-type answer from onboarding answers (prefixed or unprefixed).
 * Tries role-prefixed keys, then raw keys including defensive triple-prefix.
 * Use for both redirect logic and server-side rolesToWrite.
 */
export function getConsumerUseType(answers: OnboardingAnswers | undefined): string | undefined {
  const fromRole =
    getRoleAnswer(answers, "consumer", "consumer_use_type")
    ?? getRoleAnswer(answers, "consumer", "use_type");
  if (fromRole !== undefined) return fromRole;
  return getAnswer(answers, [
    "consumer_use_type",
    "consumer_consumer_use_type",
    "consumer_consumer_consumer_use_type",
    "use_type",
  ]);
}

/** True if useType indicates business/wholesale (case-insensitive). */
export function isConsumerWholesaleChoice(useType: string | undefined): boolean {
  if (typeof useType !== "string") return false;
  const n = useType.trim().toLowerCase();
  return n === "business" || n === "wholesale" || n === "business_wholesale";
}
