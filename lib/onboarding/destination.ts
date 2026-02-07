/**
 * Phase 1.5: Route destination after questionnaire completion.
 */

import type { OnboardingRole } from "./role";

export function getDestinationForRole(
  role: OnboardingRole,
  driverMode?: string | null
): string {
  switch (role) {
    case "vendor":
      return "/vendor-registration";
    case "driver":
      return driverMode === "vendor_listed"
        ? "/vendor-registration"
        : "/logistics/apply";
    case "industrial":
      return "/wholesale";
    case "affiliate":
      return "/affiliate";
    case "consumer":
    default:
      return "/";
  }
}
