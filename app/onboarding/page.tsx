import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";
import Footer from "@/components/Footer";
import OnboardingShellClient from "./OnboardingShellClient";

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

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  const hasVendor = !!vendor?.id;

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <OnboardingShellClient hasVendor={hasVendor} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
