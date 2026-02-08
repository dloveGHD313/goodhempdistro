import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";
import Footer from "@/components/Footer";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import { computeRoleFromWelcomeIntents } from "@/lib/onboarding/role";
import { getDestinationForRole } from "@/lib/onboarding/destination";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export default async function OnboardingIndexPage() {
  noStore();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/signup?redirect=${encodeURIComponent("/onboarding")}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("welcome_intents, onboarding_completed_at, onboarding_answers")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed_at) {
    const answers = profile?.onboarding_answers as { role?: string; driver_mode?: string } | null;
    const role = (answers?.role ?? "consumer") as "vendor" | "consumer" | "driver" | "affiliate" | "industrial";
    redirect(getDestinationForRole(role, answers?.driver_mode));
  }

  const role = computeRoleFromWelcomeIntents(profile?.welcome_intents ?? []);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <OnboardingShell role={role} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
