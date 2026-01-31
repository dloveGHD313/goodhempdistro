import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createSupabaseRouteClient } from "@/lib/supabaseRoute";
import type { NextRequest } from "next/server";

export type RequireAdminUsersResult = {
  user: { id: string } | null;
  isAdmin: boolean;
};

/**
 * Check if the authenticated user (from cookies) is in public.admin_users.
 * Use admin_users table as source of truth. No hardcoded UUIDs.
 */
export async function requireAdminUsers(req: NextRequest): Promise<RequireAdminUsersResult> {
  const { supabase } = createSupabaseRouteClient(req);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, isAdmin: false };
  }

  const admin = createSupabaseAdminClient();
  const { data: adminRow } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    user: { id: user.id },
    isAdmin: !!adminRow,
  };
}
