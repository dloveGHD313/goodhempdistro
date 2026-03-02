import { redirect } from "next/navigation";
import Link from "next/link";
import Footer from "@/components/Footer";
import { createSupabaseServerClient } from "@/lib/supabase";
import { hasRole } from "@/lib/roles";
import WholesaleApplyForm from "./WholesaleApplyForm";
import { getRoleAnswer, getRoleAnswerArray } from "@/lib/onboarding/answers";

function mapOnboardingBusinessType(v: string | undefined): string {
  if (!v) return "";
  const n = v.trim().toLowerCase();
  if (n === "apartment") return "apartment_multifamily";
  if (n === "retail") return "retail_store";
  if (["hotel", "restaurant", "distributor", "other", "na_personal"].includes(n)) return n;
  return v;
}

export default async function WholesaleApplyPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/get-started?next=/wholesale/apply");
  }

  const [profileRes, appRes] = await Promise.all([
    supabase.from("profiles").select("role, roles, onboarding_answers").eq("id", user.id).single(),
    supabase.from("wholesale_applications").select("status, business_name, business_type, company_size, products_sourcing").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const profile = profileRes.data;
  const application = appRes.data ?? null;

  if (hasRole(profile ?? undefined, "wholesale")) {
    redirect("/wholesale");
  }

  if (application?.status === "pending") {
    redirect("/wholesale");
  }

  const onboardingAnswersRaw = (profile as { onboarding_answers?: unknown } | null)?.onboarding_answers;
  const answersSource =
    onboardingAnswersRaw && typeof onboardingAnswersRaw === "object" && "answers" in onboardingAnswersRaw
      ? (onboardingAnswersRaw as { answers?: unknown }).answers
      : onboardingAnswersRaw;
  const answers =
    answersSource && typeof answersSource === "object"
      ? (answersSource as Record<string, string | string[] | undefined>)
      : undefined;
  const fromOnboarding = {
    business_name: getRoleAnswer(answers, "consumer", "wholesale_business_name") ?? undefined,
    business_type: mapOnboardingBusinessType(getRoleAnswer(answers, "consumer", "wholesale_business_type") ?? undefined),
    company_size: getRoleAnswer(answers, "consumer", "wholesale_company_size") ?? undefined,
    products_sourcing: getRoleAnswerArray(answers as Record<string, unknown>, "consumer", "wholesale_products") ?? undefined,
  };
  const fromApplication = application?.status === "rejected" && application
    ? {
        business_name: application.business_name ?? undefined,
        business_type: application.business_type ?? undefined,
        company_size: application.company_size ?? undefined,
        products_sourcing: Array.isArray(application.products_sourcing) ? application.products_sourcing : undefined,
      }
    : {};
  const prefill = {
    business_name: fromApplication.business_name ?? fromOnboarding.business_name,
    business_type: fromApplication.business_type ?? fromOnboarding.business_type,
    company_size: fromApplication.company_size ?? fromOnboarding.company_size,
    products_sourcing: (fromApplication.products_sourcing?.length ? fromApplication.products_sourcing : fromOnboarding.products_sourcing) ?? undefined,
  };

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="surface-card p-8">
              <h1 className="text-3xl font-bold mb-2 text-accent">Apply for wholesale access</h1>
              <p className="text-muted text-sm mb-6">
                Submit your business details and a resale or wholesale certificate. We&apos;ll review and notify you.
              </p>
              <WholesaleApplyForm prefill={prefill} />
            </div>
            <p className="text-center text-muted text-sm">
              <Link href="/wholesale" className="underline hover:text-white">Back to Wholesale</Link>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
