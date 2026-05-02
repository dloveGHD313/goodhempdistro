import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";
import { getDestinationForRole } from "@/lib/onboarding/destination";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

/**
 * Build 9: /onboarding is now a redirect to /get-started, which owns the
 * canonical Phase 1.5 questionnaire + state picker. Multiple legacy gates
 * (Phase15Gate, postLoginRoute, requirePhase15Complete) still send users
 * here, and they all need to land on the flow that captures onboarding_state.
 * Completed users continue to be routed to their role destination.
 */
export default async function OnboardingIndexPage() {
  noStore();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/signup?redirect=${encodeURIComponent("/get-started")}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, onboarding_answers")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed_at) {
    const answers = profile?.onboarding_answers as { role?: string; driver_mode?: string } | null;
    const role = (answers?.role ?? "consumer") as "vendor" | "consumer" | "driver" | "affiliate" | "industrial";
    redirect(getDestinationForRole(role, answers?.driver_mode));
  }

  redirect("/get-started");
}
