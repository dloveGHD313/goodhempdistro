import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { hasRole } from "@/lib/roles";

export const metadata: Metadata = {
  title: "GoodHempDistro — The Hemp Industry, All in One Place",
  description:
    "Discover lab-tested hemp products, connect with verified vendors, and explore the hemp ecosystem on GoodHempDistro's compliant marketplace.",
  openGraph: {
    title: "GoodHempDistro — The Hemp Industry, All in One Place",
    description:
      "Discover lab-tested hemp products, connect with verified vendors, and explore the hemp ecosystem.",
    url: "https://www.goodhempdistro.com",
    siteName: "GoodHempDistro",
    type: "website",
  },
};

/**
 * Root routing (CEO vision):
 * - Not authenticated → /welcome
 * - Authenticated, onboarding not completed → /get-started
 * - Authenticated, onboarding completed (or admin) → /newsfeed (feed)
 */
export default async function HomePage() {
  let user: { id: string } | null = null;
  let profile:
    | { onboarding_completed_at?: string | null; role?: string | null; roles?: string[] | null }
    | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();

    user = supabaseUser;

    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed_at, role, roles")
        .eq("id", user.id)
        .maybeSingle();

      profile = data;
    }
  } catch (error) {
    console.error("[homepage] failed to load auth/profile, redirecting to /welcome", error);
  }

  if (!user) {
    redirect("/welcome");
  }

  const completed = !!profile?.onboarding_completed_at || hasRole(profile ?? undefined, "admin");

  if (completed) {
    redirect("/newsfeed");
  }

  redirect("/get-started");
}
