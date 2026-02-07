/**
 * Single source of truth for post-login redirect.
 * ROUTING RULE: First-time users (missing profile or onboarding incomplete) MUST go to /onboarding.
 * Returning users who completed onboarding may go to /dashboard.
 */

export type PostLoginProfile = {
  role?: string | null;
  onboarding_completed_at?: string | null;
  consumer_onboarding_completed?: boolean | null;
} | null;

/**
 * Returns the correct redirect path after login.
 * - null profile or missing onboarding completion -> "/onboarding"
 * - admin role -> "/dashboard"
 * - onboarding_completed_at set and consumer_onboarding_completed true -> "/dashboard"
 * - otherwise -> "/onboarding"
 */
export function getPostLoginRoute(profile: PostLoginProfile): "/onboarding" | "/dashboard" {
  if (!profile) {
    return "/onboarding";
  }
  if (profile.role === "admin") {
    return "/dashboard";
  }
  const phase15Done = !!profile.onboarding_completed_at;
  const consumerDone = !!profile.consumer_onboarding_completed;
  if (phase15Done && consumerDone) {
    return "/dashboard";
  }
  return "/onboarding";
}
