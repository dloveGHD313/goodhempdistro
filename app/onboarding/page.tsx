import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export default async function OnboardingIndexPage() {
  noStore();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent("/onboarding/consumer")}`);
  }

  redirect("/onboarding/consumer");
}
