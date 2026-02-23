import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";

/**
 * Root routing (CEO vision):
 * - Not authenticated → /welcome
 * - Authenticated, onboarding not completed → /get-started
 * - Authenticated, onboarding completed → /newsfeed (feed)
 */
export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/welcome");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, role")
    .eq("id", user.id)
    .maybeSingle();

  const completed = !!profile?.onboarding_completed_at || profile?.role === "admin";

  if (completed) {
    redirect("/newsfeed");
  }

  redirect("/get-started");
}
