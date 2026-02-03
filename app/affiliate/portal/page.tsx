import { redirect } from "next/navigation";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import AffiliatePortalClient from "../../affiliates/portal/AffiliatePortalClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Canonical affiliate portal URL: /affiliate/portal (singular).
 * Auth-gated; fetches affiliate_code and renders AffiliatePortalClient.
 */
export default async function AffiliatePortalPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    redirect("/login?redirect=/affiliate/portal");
  }

  const { data: affiliate } = await supabase
    .from("affiliates")
    .select("id, affiliate_code")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!affiliate) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="surface-card p-8 text-center">
              <h1 className="text-xl font-semibold mb-2 text-accent">Get your affiliate code first</h1>
              <p className="text-muted mb-4">Visit the affiliate page to create your account and referral link.</p>
              <Link href="/affiliate" className="btn-secondary">Go to Affiliate</Link>
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
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 text-accent">Affiliate Portal</h1>
            <p className="text-muted">Earnings, payouts, and Stripe Connect.</p>
          </div>
          <AffiliatePortalClient affiliateCode={affiliate.affiliate_code} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
