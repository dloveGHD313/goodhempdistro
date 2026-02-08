import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getPostLoginRoute, type PostLoginProfile } from "@/lib/routing/postLoginRoute";

/**
 * Returns the correct redirect path after login (first-time -> /onboarding, returning -> /dashboard).
 * Used by client-side login/signup to avoid sending users to /dashboard before onboarding is complete.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ redirectTo: "/onboarding" as const });
  }

  const { data } = await supabase
    .from("profiles")
    .select("role, onboarding_completed_at, consumer_onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  const profile: PostLoginProfile = data
    ? {
        role: data.role ?? null,
        onboarding_completed_at: data.onboarding_completed_at ?? null,
        consumer_onboarding_completed: data.consumer_onboarding_completed ?? null,
      }
    : null;

  const redirectTo = getPostLoginRoute(profile);
  return NextResponse.json({ redirectTo });
}
