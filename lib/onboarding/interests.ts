/**
 * Extract a short list of human-readable interest labels from onboarding answers.
 * Answers are role-prefixed (e.g. consumer_consumer_interest, vendor_what_sell).
 * Used by the post-onboarding welcome banner on /newsfeed.
 */

import { getQuestionsForRole } from "./questions";
import type { OnboardingRole } from "./role";

const ROLE_INTEREST_QUESTION_IDS: Record<string, string[]> = {
  consumer: ["consumer_interest", "consumer_categories"],
  vendor: ["vendor_what_sell"],
  driver: ["driver_interested"],
  affiliate: ["affiliate_promotion"],
  builder: ["builder_focus"],
  educator: ["educator_interests"],
  industrial: ["industrial_need"],
  events: ["events_interest"],
};

function valuesToArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  }
  if (typeof value === "string" && value.trim().length > 0) return [value.trim()];
  return [];
}

function lookupLabel(role: OnboardingRole, questionId: string, value: string): string | null {
  const questions = getQuestionsForRole(role);
  for (const q of questions) {
    if (q.id !== questionId) continue;
    const opt = q.options.find((o) => o.value === value);
    if (opt) return opt.label;
  }
  return null;
}

/**
 * Returns up to `limit` interest labels derived from answers across all roles.
 * Deduplicated by label.
 */
export function extractInterestsFromAnswers(
  answers: Record<string, unknown> | null | undefined,
  roles: string[] | null | undefined,
  limit = 2
): string[] {
  if (!answers || typeof answers !== "object") return [];
  const out: string[] = [];
  const seen = new Set<string>();

  const knownRoles = (Array.isArray(roles) ? roles : [])
    .map((r) => String(r).toLowerCase().trim())
    .filter((r) => r in ROLE_INTEREST_QUESTION_IDS) as OnboardingRole[];

  // Fall back to consumer if no recognized role.
  const effectiveRoles: OnboardingRole[] =
    knownRoles.length > 0 ? knownRoles : ["consumer"];

  for (const role of effectiveRoles) {
    const ids = ROLE_INTEREST_QUESTION_IDS[role] ?? [];
    for (const id of ids) {
      const prefixedKey = `${role}_${id}`;
      const values = valuesToArray(answers[prefixedKey] ?? answers[id]);
      for (const v of values) {
        const label = lookupLabel(role, id, v);
        if (!label) continue;
        const key = label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(label);
        if (out.length >= limit) return out;
      }
    }
  }

  return out;
}
