import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase";

/**
 * Phase 1.5: Require post-auth questionnaire completion.
 * Returns redirect path if user must complete onboarding first.
 */
export async function requirePhase15Complete(userId: string | null): Promise<string | null> {
  if (!userId) return null;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, role")
    .eq("id", userId)
    .maybeSingle();

  if (data?.role === "admin") return null;
  if (data?.onboarding_completed_at) return null;
  return "/onboarding";
}
