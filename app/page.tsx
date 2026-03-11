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
