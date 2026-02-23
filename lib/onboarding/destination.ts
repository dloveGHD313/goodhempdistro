/**
 * Phase 1.5: Route destination after questionnaire completion.
 * Multi-role: prioritize setup-required (vendor/events → pricing), then dashboards, then feed.
 * Driver role respects driver_mode answer (vendor-type → pricing; else → logistics/apply).
 */

import type { OnboardingRole } from "./role";

/** driver_mode values that mean "offer own services / vendor-listed" → route to vendor pricing */
const DRIVER_MODE_VENDOR_PATH = new Set([
  "vendor_listed",
  "offer_own_services",
  "self_provider",
  "independent",
  "both",
]);

function normalizeDriverMode(answers: Record<string, string | string[] | undefined> | undefined): string | undefined {
  if (!answers) return undefined;
  const raw =
    answers["driver_driver_mode"] ??
    answers["driver_mode"];
  if (raw === undefined) return undefined;
  if (typeof raw === "string") return raw.trim() || undefined;
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "string")
    return raw[0].trim() || undefined;
  return undefined;
}

export function getDestinationForRole(
  role: OnboardingRole,
  driverMode?: string | null
): string {
  switch (role) {
    case "vendor":
    case "events":
      return "/pricing?tab=vendor";
    case "driver":
      return driverMode != null && DRIVER_MODE_VENDOR_PATH.has(driverMode)
        ? "/pricing?tab=vendor"
        : "/logistics/apply";
    case "industrial":
      return "/discover";
    case "affiliate":
      return "/affiliate/portal";
    case "builder":
      return "/services";
    case "educator":
      return "/learning-with-jax";
    case "consumer":
    default:
      return "/newsfeed";
  }
}

/**
 * Post-onboarding destination from roles array and optional answers.
 * When roles includes "driver", driver_mode from answers (keys driver_driver_mode or driver_mode)
 * is used: vendor-type values → /pricing?tab=vendor; else → /logistics/apply.
 */
export function getDestinationForRoles(
  roles: string[],
  answers?: Record<string, string | string[]>
): string {
  const set = new Set(roles.map((r) => r.toLowerCase()));

  if (set.has("vendor") || set.has("events")) return "/pricing?tab=vendor";
  if (set.has("affiliate")) return "/affiliate/portal";
  if (set.has("driver")) {
    const driverMode = normalizeDriverMode(answers);
    return driverMode != null && DRIVER_MODE_VENDOR_PATH.has(driverMode)
      ? "/pricing?tab=vendor"
      : "/logistics/apply";
  }
  if (set.has("builder")) return "/services";
  if (set.has("educator")) return "/learning-with-jax";
  if (set.has("industrial")) return "/discover";
  if (set.has("wholesale")) {
    // TODO: Future wholesale certificate upload + verification; Stripe gating for tax-free purchase if required.
    return "/wholesale";
  }
  return "/newsfeed";
}
