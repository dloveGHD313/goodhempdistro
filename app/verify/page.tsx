import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export default async function VerifyStartPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(`/login?redirect=${encodeURIComponent("/verify")}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("age_verified, id_verification_status")
    .eq("id", user.id)
    .maybeSingle();

  const verified = profile?.age_verified === true && profile?.id_verification_status === "verified";
  const pending = profile?.id_verification_status === "pending";

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-3xl mx-auto card-glass p-8 space-y-6 text-center">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">21+ Verification</p>
              <h1 className="text-3xl font-bold text-accent">
                Verify your ID to unlock the intoxicating market
              </h1>
              <p className="text-muted">
                The intoxicating market includes smokable or consumable products and requires a quick
                verification step with an ID upload.
              </p>
            </div>

            {verified ? (
              <div className="card-glass p-4 border border-green-500/40 text-green-300">
                You are verified and can access gated products.
              </div>
            ) : pending ? (
              <div className="card-glass p-4 border border-yellow-500/40 text-yellow-200">
                Your verification is pending review. Check status anytime.
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {verified ? (
                <a href="/products" className="btn-primary">
                  Browse Products
                </a>
              ) : (
                <a href="/verify/upload" className="btn-primary">
                  Start Verification
                </a>
              )}
              <a href="/verify/status" className="btn-secondary">
                Check Status
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
