import { redirect } from "next/navigation";
import { brand } from "@/lib/brand";
import { createSupabaseServerClient } from "@/lib/supabase";
import StartFlowClient from "./start/StartFlowClient";
import { getDefaultRouteForUser } from "@/lib/phase2-workout-flow";

export const dynamic = "force-dynamic";

export const metadata = {
  title: brand.name,
  description: "Choose your path: Shopper, Vendor, Logistics, Builder, or Affiliate. We'll take you to the right place.",
};

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If NOT logged in → show Start
  if (!user) {
    return <StartFlowClient />;
  }

  // If logged in → fetch account role + workout_path and redirect
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, workout_path")
    .eq("id", user.id)
    .maybeSingle();

  const defaultRoute = getDefaultRouteForUser({
    accountRole: profile?.role ?? null,
    workoutPath: profile?.workout_path ?? null,
  });

  redirect(defaultRoute);
}
