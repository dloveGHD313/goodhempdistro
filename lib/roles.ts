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

/** Returns normalized roles array (never null, never empty). Merges legacy `role` with `roles` so admin set only via SQL is still recognized. */
function getRoles(profile: ProfileWithRoles | null | undefined): string[] {
  if (!profile) return ["consumer"];
  const merged = new Set<string>();

  // From roles array
  if (Array.isArray(profile.roles) && profile.roles.length > 0) {
    for (const x of profile.roles) {
      if (typeof x !== "string") continue;
      const n = x.trim().toLowerCase();
      if (n && ALLOWED_SET.has(n)) merged.add(n);
    }
  }

  // Legacy role: merge in so admin created via SQL (role = 'admin' only) is not ignored
  const single = profile.role && String(profile.role).trim().toLowerCase();
  if (single && ALLOWED_SET.has(single)) merged.add(single);

  if (merged.size > 0) return Array.from(merged);
  return ["consumer"];
}

/** Returns true if profile has the given role (checks roles array first, then legacy role). */
export function hasRole(profile: ProfileWithRoles | null | undefined, role: string): boolean {
  const roles = getRoles(profile);
  const r = role.toLowerCase();
  return roles.some((x) => String(x).toLowerCase() === r);
}
