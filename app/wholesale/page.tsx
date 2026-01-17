import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";

export default async function WholesalePage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "vendor" && profile?.role !== "admin") {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="max-w-4xl mx-auto surface-card p-8 text-center">
              <h1 className="text-4xl font-bold mb-4 text-accent">Wholesale</h1>
              <p className="text-muted mb-6">
                Vendor access required. Upgrade to a vendor plan to unlock wholesale pricing.
              </p>
              <div className="flex gap-3 flex-wrap justify-center">
                <Link href="/vendor-registration" className="btn-primary">View Vendor Plans</Link>
                <Link href="/dashboard" className="btn-secondary">Back to Dashboard</Link>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  const { data: activeSubscription } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("package_type", "vendor")
    .in("status", ["active", "trialing"])
    .maybeSingle();

  if (!activeSubscription) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="max-w-4xl mx-auto surface-card p-8 text-center">
              <h1 className="text-4xl font-bold mb-4 text-accent">Wholesale</h1>
              <p className="text-muted mb-6">
                Your vendor subscription is inactive. Reactivate to access wholesale pricing.
              </p>
              <div className="flex gap-3 flex-wrap justify-center">
                <Link href="/vendor-registration" className="btn-primary">Manage Vendor Plan</Link>
                <Link href="/dashboard" className="btn-secondary">Back to Dashboard</Link>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-4xl mx-auto surface-card p-8">
            <h1 className="text-4xl font-bold mb-4 text-accent">Wholesale</h1>
            <p className="text-muted mb-6">
              Access to wholesale marketplace. Your vendor subscription is active.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
