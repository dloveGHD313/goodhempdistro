import type { User } from "@supabase/supabase-js";

export type DerivedProfileFields = {
  email: string | null;
  emailPrefix: string;
  displayName: string | null;
  username: string | null;
};

/**
 * Derive profile fields from a Supabase Auth User for use in profile insert/update.
 * Consistent logic: display_name from meta (string + trim) or email prefix; username from meta or sanitized email prefix (max 64 chars).
 */
export function deriveProfileFieldsFromUser(user: User | null | undefined): DerivedProfileFields {
  const email = user?.email ?? null;
  const emailPrefix = email ? email.split("@")[0] : "";

  const rawDisplayName = user?.user_metadata?.display_name;
  const displayName =
    typeof rawDisplayName === "string" && rawDisplayName.trim() !== ""
      ? rawDisplayName.trim()
      : emailPrefix
        ? emailPrefix
        : null;

  const rawUsername = user?.user_metadata?.username;
  const fromMeta = typeof rawUsername === "string" && rawUsername.trim() !== "" ? rawUsername.trim() : null;
  const sanitizedPrefix = emailPrefix ? emailPrefix.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 64) || null : null;
  const username = fromMeta ?? sanitizedPrefix ?? null;

  return { email, emailPrefix, displayName, username };
}
