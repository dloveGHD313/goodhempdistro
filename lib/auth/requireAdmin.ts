import { createSupabaseServerClient } from "@/lib/supabase";

export type RequireAdminResult = {
  user: { id: string; email?: string } | null;
  isAdmin: boolean;
  reason: string;
  profile: { id: string; role?: string | null; is_admin?: boolean | null } | null;
};

const normalizeEmail = (email: string | undefined | null) =>
  (email || "").trim().toLowerCase();

const getAllowlist = () => {
  const emails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const domain = (process.env.ADMIN_EMAIL_DOMAIN || "").trim().toLowerCase();
  return { emails, domain };
};

const isAdminByAllowlist = (email: string | undefined | null): { ok: boolean; reason: string } => {
  const { emails, domain } = getAllowlist();
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return { ok: false, reason: "allowlist_no_email" };
  }

  if (emails.length > 0 && emails.includes(normalized)) {
    return { ok: true, reason: "allowlist_email" };
  }

  if (domain && normalized.endsWith(`@${domain}`)) {
    return { ok: true, reason: "allowlist_domain" };
  }

  if (!emails.length && !domain) {
    return { ok: false, reason: "allowlist_missing" };
  }

  return { ok: false, reason: "allowlist_no_match" };
};

const isAdminByProfile = (profile: { role?: string | null; is_admin?: boolean | null } | null) => {
  return profile?.is_admin === true || profile?.role === "admin";
};

export async function requireAdmin(): Promise<RequireAdminResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user ? { id: data.user.id, email: data.user.email || undefined } : null;

  if (error || !user) {
    if (error) {
      console.error("[requireAdmin] auth_error", { message: error.message });
    }
    return { user: null, isAdmin: false, reason: "unauthenticated", profile: null };
  }

  let profile: RequireAdminResult["profile"] = null;
  let profileReason = "profile_missing";

  const attemptProfileSelect = async (fields: string) => {
    return supabase
      .from("profiles")
      .select(fields)
      .eq("id", user.id)
      .maybeSingle();
  };

  const primary = await attemptProfileSelect("id, role, is_admin");
  if (primary.error) {
    if (/column .* does not exist/i.test(primary.error.message || "")) {
      const fallback = await attemptProfileSelect("id, role");
      if (fallback.error) {
        console.error("[requireAdmin] profile_fetch_error", {
          code: fallback.error.code,
          message: fallback.error.message,
          details: fallback.error.details,
          hint: fallback.error.hint,
        });
        profileReason = "profile_fetch_error";
      } else {
        const fallbackData = (fallback.data as RequireAdminResult["profile"]) || null;
        profile = fallbackData;
        profileReason = profile ? "profile_loaded_without_is_admin" : "profile_missing";
      }
    } else {
      console.error("[requireAdmin] profile_fetch_error", {
        code: primary.error.code,
        message: primary.error.message,
        details: primary.error.details,
        hint: primary.error.hint,
      });
      profileReason = "profile_fetch_error";
    }
  } else {
    const primaryData = (primary.data as RequireAdminResult["profile"]) || null;
    profile = primaryData;
    profileReason = profile ? "profile_loaded" : "profile_missing";
  }

  if (isAdminByProfile(profile)) {
    return { user, isAdmin: true, reason: profile?.is_admin ? "profile_is_admin" : "profile_role", profile };
  }

  const allowlist = isAdminByAllowlist(user.email);
  if (allowlist.ok) {
    return { user, isAdmin: true, reason: allowlist.reason, profile };
  }

  return { user, isAdmin: false, reason: profileReason || allowlist.reason, profile };
}
