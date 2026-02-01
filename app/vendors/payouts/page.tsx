import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import PayoutsClient from "./PayoutsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VendorPayoutsPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    redirect("/login?redirect=/vendors/payouts");
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!vendor) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="surface-card p-8 text-center">
              <h1 className="text-xl font-semibold mb-2 text-accent">Vendor account required</h1>
              <p className="text-muted mb-4">You need a vendor account to manage payouts.</p>
              <Link href="/vendors/dashboard" className="btn-secondary">Dashboard</Link>
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
            <h1 className="text-4xl font-bold mb-2 text-accent">Payouts</h1>
            <p className="text-muted">Connect Stripe to receive payouts (referral rewards and sales).</p>
          </div>
          <PayoutsClient />
        </section>
      </main>
      <Footer />
    </div>
  );
}
