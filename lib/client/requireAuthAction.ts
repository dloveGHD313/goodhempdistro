import { isSafeNextPath } from "@/lib/phase2-workout-flow";

/**
 * Returns redirect URL when an unauthenticated user attempts a gated action (e.g. like, comment, post).
 * Use with router.push() to send them to Start with a safe "next" so they can return after login.
 */
export function getAuthRequiredRedirect(currentPath: string | null | undefined): string {
  if (isSafeNextPath(currentPath)) {
    return `/?next=${encodeURIComponent(currentPath)}`;
  }
  return "/";
}
