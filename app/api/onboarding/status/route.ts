import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { hasRole } from "@/lib/roles";

/**
 * Returns whether the current user has completed Phase 1.5 onboarding.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ completed: false, authenticated: false });
  }

  const { data } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, role, roles")
    .eq("id", user.id)
    .maybeSingle();

  const completed = !!data?.onboarding_completed_at || hasRole(data ?? undefined, "admin");
  return NextResponse.json({ completed, authenticated: true });
}
