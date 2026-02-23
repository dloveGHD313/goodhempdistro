import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { hasRole } from "@/lib/roles";

/**
 * Root routing (CEO vision):
 * - Not authenticated → /welcome
 * - Authenticated, onboarding not completed → /get-started
 * - Authenticated, onboarding completed (or admin) → /newsfeed (feed)
 */
export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/welcome");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, role, roles")
    .eq("id", user.id)
    .maybeSingle();

  const completed = !!profile?.onboarding_completed_at || hasRole(profile ?? undefined, "admin");

  if (completed) {
    redirect("/newsfeed");
  }

  redirect("/get-started");
}
