import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import ConsumerOnboardingClient from "./ConsumerOnboardingClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

type ConsumerProfile = {
  role: string | null;
  market_mode_preference: string | null;
  consumer_type: "individual" | "business" | null;
  business_type:
    | "hotel"
    | "apartment"
    | "spa"
    | "office"
    | "retail"
    | "event"
    | "staff_buyers"
    | "b2b"
    | "other"
    | null;
  purchase_intent: ("bulk" | "recurring" | "one-time")[] | null;
  interests: ("products" | "services" | "education" | "events")[] | null;
  experience_level: "new" | "experienced" | null;
  state: string | null;
  city: string | null;
  company_size: string | null;
  consumer_interest_tags: string[] | null;
  consumer_use_case: string | null;
  consumer_onboarding_step: number | null;
  consumer_onboarding_completed: boolean | null;
};

export default async function ConsumerOnboardingPage() {
  noStore();
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(`/login?redirect=${encodeURIComponent("/onboarding/consumer")}`);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "role, market_mode_preference, consumer_type, business_type, purchase_intent, interests, experience_level, state, city, company_size, consumer_interest_tags, consumer_use_case, consumer_onboarding_step, consumer_onboarding_completed"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role && profile.role !== "consumer") {
    redirect("/dashboard");
  }

  if (profile?.consumer_onboarding_completed) {
    redirect("/dashboard");
  }

  const initialProfile: ConsumerProfile = {
    role: profile?.role ?? "consumer",
    market_mode_preference: profile?.market_mode_preference ?? "CBD_WELLNESS",
    consumer_type: profile?.consumer_type ?? null,
    business_type: profile?.business_type ?? null,
    purchase_intent: profile?.purchase_intent ?? [],
    interests: profile?.interests ?? [],
    experience_level: profile?.experience_level ?? null,
    state: profile?.state ?? null,
    city: profile?.city ?? null,
    company_size: profile?.company_size ?? null,
    consumer_interest_tags: profile?.consumer_interest_tags ?? [],
    consumer_use_case: profile?.consumer_use_case ?? null,
    consumer_onboarding_step: profile?.consumer_onboarding_step ?? 0,
    consumer_onboarding_completed: profile?.consumer_onboarding_completed ?? false,
  };

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <ConsumerOnboardingClient
            userId={user.id}
            initialProfile={initialProfile}
            initialError={profileError?.message || null}
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}
