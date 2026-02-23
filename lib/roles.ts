/**
 * Multi-role helpers. Profiles may have roles: consumer, admin, vendor, driver, affiliate, builder, educator, industrial.
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
] as const;

export type ProfileRole = (typeof ALLOWED_ROLES)[number];

export type ProfileWithRoles = {
  role?: string | null;
  roles?: string[] | null;
};

/** Returns true if profile has the given role (checks roles array first, then legacy role). */
export function hasRole(profile: ProfileWithRoles | null | undefined, role: string): boolean {
  if (!profile) return false;
  const r = role.toLowerCase();
  if (Array.isArray(profile.roles)) {
    return profile.roles.some((x) => String(x).toLowerCase() === r);
  }
  return String(profile.role || "").toLowerCase() === r;
}

/** Returns normalized roles array (never null). */
export function getRoles(profile: ProfileWithRoles | null | undefined): string[] {
  if (!profile) return ["consumer"];
  if (Array.isArray(profile.roles) && profile.roles.length > 0) {
    return profile.roles.filter((x) => typeof x === "string" && ALLOWED_ROLES.includes(x as ProfileRole));
  }
  const single = profile.role && String(profile.role).toLowerCase();
  if (single && ALLOWED_ROLES.includes(single as ProfileRole)) return [single];
  return ["consumer"];
}
