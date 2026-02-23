/**
 * Multi-role helpers. Profiles may have roles: consumer, admin, vendor, driver, affiliate, builder, educator, industrial, events.
 */

export const ALLOWED_ROLES = [
  "consumer",
  "admin",
  "vendor",
  "driver",
  "affiliate",
  "builder",
  "educator",
  "industrial",
  "events",
] as const;

export type ProfileRole = (typeof ALLOWED_ROLES)[number];

export type ProfileWithRoles = {
  role?: string | null;
  roles?: string[] | null;
};

const ALLOWED_SET = new Set(ALLOWED_ROLES as unknown as string[]);

/** Returns normalized roles array (never null, never empty). Internal helper used by hasRole. */
function getRoles(profile: ProfileWithRoles | null | undefined): string[] {
  if (!profile) return ["consumer"];
  if (Array.isArray(profile.roles) && profile.roles.length > 0) {
    const normalized = profile.roles
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim().toLowerCase())
      .filter((x) => x.length > 0 && ALLOWED_SET.has(x));
    if (normalized.length > 0) return normalized;
  }
  const single = profile.role && String(profile.role).trim().toLowerCase();
  if (single && ALLOWED_SET.has(single)) return [single];
  return ["consumer"];
}

/** Returns true if profile has the given role (checks roles array first, then legacy role). */
export function hasRole(profile: ProfileWithRoles | null | undefined, role: string): boolean {
  const roles = getRoles(profile);
  const r = role.toLowerCase();
  return roles.some((x) => String(x).toLowerCase() === r);
}
