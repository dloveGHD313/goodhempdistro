import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";
import VendorReferralPayoutsClient from "./VendorReferralPayoutsClient";

export const dynamic = "force-dynamic";

export default async function AdminVendorReferralPayoutsPage() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/vendor-referrals/payouts");
  }
  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="mb-8">
            <Link href="/admin/vendors" className="text-accent text-sm hover:underline mb-4 inline-block">
              ← Vendors
            </Link>
            <h1 className="text-4xl font-bold text-accent">Vendor Referral Payout Queue</h1>
            <p className="text-muted mt-1">Approve requested payouts (Stripe Transfer to vendor Connect account).</p>
          </div>
          <VendorReferralPayoutsClient />
        </section>
      </main>
      <Footer />
    </div>
  );
}
