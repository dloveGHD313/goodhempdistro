/**
 * Maps welcome intents to post-auth destination route.
 * Priority order: sell > drivers > services > events > industrial > default.
 */
export function getWelcomeDestination(intents: string[]): string {
  const lower = intents.map((s) => s.toLowerCase());
  if (lower.includes("sell")) return "/vendor-registration";
  if (lower.includes("drivers")) return "/logistics/apply";
  if (lower.includes("services")) return "/services";
  if (lower.includes("events")) return "/events";
  if (lower.includes("industrial")) return "/wholesale";
  return "/";
}
