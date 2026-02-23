/**
 * Phase 1.5: Route destination after questionnaire completion.
 * Multi-role: prioritize setup-required (vendor/events → pricing), then dashboards, then feed.
 */

import type { OnboardingRole } from "./role";

export function getDestinationForRole(
  role: OnboardingRole,
  driverMode?: string | null
): string {
  switch (role) {
    case "vendor":
    case "events":
      return "/pricing?tab=vendor";
    case "driver":
      return driverMode === "vendor_listed"
        ? "/vendor-registration"
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

/** Priority order for multi-role routing: first match wins. */
const DESTINATION_PRIORITY: { roles: OnboardingRole[]; path: string }[] = [
  { roles: ["vendor", "events"], path: "/pricing?tab=vendor" },
  { roles: ["affiliate"], path: "/affiliate/portal" },
  { roles: ["driver"], path: "/logistics/apply" },
  { roles: ["builder"], path: "/services" },
  { roles: ["educator"], path: "/learning-with-jax" },
  { roles: ["industrial"], path: "/discover" },
  { roles: ["consumer"], path: "/newsfeed" },
];

/**
 * Post-onboarding destination from roles array.
 * Vendor/events → vendor pricing; affiliate → portal; consumer-only → feed; etc.
 */
export function getDestinationForRoles(roles: string[]): string {
  const set = new Set(roles.map((r) => r.toLowerCase()));
  for (const { roles: checkRoles, path } of DESTINATION_PRIORITY) {
    if (checkRoles.some((r) => set.has(r))) return path;
  }
  return "/newsfeed";
}
