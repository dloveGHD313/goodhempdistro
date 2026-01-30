import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getUserVerificationStatus } from "@/lib/server/idVerification";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export default async function VerifyAgePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(`/login?redirect=${encodeURIComponent("/verify-age")}`);
  }

  const verification = await getUserVerificationStatus(user.id);
  const approved = verification.status === "approved";
  const pending = verification.status === "pending";
  const rejected = verification.status === "rejected";

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-3xl mx-auto card-glass p-8 space-y-6 text-center">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-muted">21+ Verification</p>
              <h1 className="text-3xl font-bold text-accent">
                Required for smokable / intoxicating products
              </h1>
              <p className="text-muted">
                Upload a government ID to unlock gated products in the intoxicating market.
              </p>
            </div>

            {approved ? (
              <div className="card-glass p-4 border border-green-500/40 text-green-300">
                You are approved and can access gated products.
              </div>
            ) : pending ? (
              <div className="card-glass p-4 border border-yellow-500/40 text-yellow-200">
                Your verification is pending review. Check status anytime.
              </div>
            ) : rejected ? (
              <div className="card-glass p-4 border border-red-500/40 text-red-300">
                Your verification was rejected. Please resubmit with clearer ID images.
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {approved ? (
                <a href="/products" className="btn-primary">
                  Browse Products
                </a>
              ) : (
                <a href="/verify-age/upload" className="btn-primary">
                  Upload ID
                </a>
              )}
              <a href="/verify-age/status" className="btn-secondary">
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
