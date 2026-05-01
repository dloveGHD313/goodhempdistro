import { createSupabaseServerClient } from "@/lib/supabase";
import { extractInterestsFromAnswers } from "@/lib/onboarding/interests";
import WelcomeBannerDismiss from "./WelcomeBannerDismiss";

function deriveGreetingName(displayName: string | null, email: string | null): string {
  const name = (displayName ?? "").trim();
  if (name) return name;
  const local = (email ?? "").split("@")[0]?.trim() ?? "";
  return local || "there";
}

type ProfileRow = {
  display_name: string | null;
  email: string | null;
  roles: string[] | null;
  onboarding_completed_at: string | null;
  onboarding_answers: Record<string, unknown> | null;
};

export default async function WelcomeBanner() {
  let profile: ProfileRow | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from("profiles")
      .select("display_name, email, roles, onboarding_completed_at, onboarding_answers")
      .eq("id", user.id)
      .maybeSingle();
    profile = (data as unknown as ProfileRow | null) ?? null;
  } catch {
    return null;
  }

  if (!profile?.onboarding_completed_at) return null;

  const answers =
    profile.onboarding_answers && typeof profile.onboarding_answers === "object"
      ? ((profile.onboarding_answers as { answers?: Record<string, unknown> }).answers ??
        (profile.onboarding_answers as Record<string, unknown>))
      : null;

  const greeting = deriveGreetingName(profile.display_name, profile.email);
  const interests = extractInterestsFromAnswers(answers, profile.roles, 2);

  return <WelcomeBannerDismiss greeting={greeting} interests={interests} />;
}
