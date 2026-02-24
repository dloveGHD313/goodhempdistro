import Link from "next/link";
import Footer from "@/components/Footer";
import { createSupabaseServerClient } from "@/lib/supabase";
import { hasRole } from "@/lib/roles";

export default async function WholesalePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user?.id;

  let profile: { role?: string | null; roles?: string[] | null } | null = null;
  let application: { status: string } | null = null;
  if (user?.id) {
    const [profileRes, appRes] = await Promise.all([
      supabase.from("profiles").select("role, roles").eq("id", user.id).single(),
      supabase.from("wholesale_applications").select("status").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    profile = profileRes.data ?? null;
    application = appRes.data ?? null;
  }

  const hasWholesaleAccess = isLoggedIn && hasRole(profile ?? undefined, "wholesale");

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="surface-card p-8">
              <h1 className="text-4xl font-bold mb-4 text-accent">Wholesale</h1>
              <p className="text-muted">
                Wholesale access for approved buyers and vetted vendors.
              </p>
            </div>

            {/* A: Not logged in */}
            {!isLoggedIn && (
              <div className="card-glass p-8 text-center space-y-4">
                <p className="text-muted">Sign in or create an account to apply for wholesale access.</p>
                <div className="flex gap-3 flex-wrap justify-center">
                  <Link href="/login" className="btn-primary">Sign in</Link>
                  <Link href="/get-started" className="btn-secondary">Get Started</Link>
                </div>
              </div>
            )}

            {/* B/C: Logged in, no wholesale access — Apply or Re-apply + status */}
            {isLoggedIn && !hasWholesaleAccess && (
              <div className="card-glass p-8 space-y-4">
                {application?.status === "pending" && (
                  <p className="text-muted">Your application is under review. We&apos;ll notify you once it&apos;s processed.</p>
                )}
                {application?.status === "rejected" && (
                  <p className="text-muted">Your previous application was not approved. You may re-apply with updated information.</p>
                )}
                {(!application || application.status === "rejected") && (
                  <p className="text-muted">Apply for wholesale access by submitting your business details and resale/wholesale certificate.</p>
                )}
                <div className="flex gap-3 flex-wrap">
                  <Link href="/wholesale/apply" className="btn-primary">
                    {application?.status === "rejected" ? "Re-apply for access" : "Apply for access"}
                  </Link>
                </div>
              </div>
            )}

            {/* D: Wholesale access approved */}
            {hasWholesaleAccess && (
              <div className="card-glass p-8 text-center space-y-4">
                <p className="text-accent font-semibold">Wholesale Access Approved</p>
                <p className="text-muted">Wholesale listings are coming soon. You&apos;ll be notified when they&apos;re available.</p>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
