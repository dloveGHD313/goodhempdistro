import "server-only";

import { isAdminEmail } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { hasRole } from "@/lib/roles";

type AdminProfileRow = {
  role?: string | null;
  roles?: string[] | null;
  is_admin?: boolean | null;
};

export async function resolveIsAdmin(userId: string, email: string): Promise<boolean> {
  if (isAdminEmail(email)) {
    return true;
  }

  if (!userId) {
    return false;
  }

  try {
    const admin = createSupabaseAdminClient();

    const { data: adminRow } = await admin
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (adminRow) {
      return true;
    }

    const primary = await admin
      .from("profiles")
      .select("role, roles, is_admin")
      .eq("id", userId)
      .maybeSingle<AdminProfileRow>();

    if (primary.error && /column .* does not exist/i.test(primary.error.message || "")) {
      const fallback = await admin
        .from("profiles")
        .select("role, roles")
        .eq("id", userId)
        .maybeSingle<AdminProfileRow>();
      return hasRole(fallback.data ?? undefined, "admin");
    }

    return primary.data?.is_admin === true || hasRole(primary.data ?? undefined, "admin");
  } catch (error) {
    console.error("[resolveIsAdmin] Failed to resolve admin status", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
