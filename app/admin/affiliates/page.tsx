import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";

export const dynamic = 'force-dynamic';

async function getAffiliatesData() {
  const admin = getSupabaseAdminClient();
  
  const { data: affiliates } = await admin
    .from("affiliates")
    .select("id, user_id, affiliate_code, status, created_at")
    .order("created_at", { ascending: false });

  const { data: referrals } = await admin
    .from("affiliate_referrals")
    .select("id, affiliate_id, referred_user_id, plan_type, reward_cents, status, created_at")
    .order("created_at", { ascending: false });

  return {
    affiliates: affiliates || [],
    referrals: referrals || [],
  };
}

export default async function AdminAffiliatesPage() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/affiliates");
  }

  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  const { affiliates, referrals } = await getAffiliatesData();

  const totalPending = referrals.filter((r) => r.status === "pending").reduce((sum, r) => sum + (r.reward_cents || 0), 0);
  const totalPaid = referrals.filter((r) => r.status === "paid").reduce((sum, r) => sum + (r.reward_cents || 0), 0);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Affiliate Management</h1>

          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <div className="card-glass p-6">
              <h3 className="text-lg text-muted mb-2">Total Affiliates</h3>
              <p className="text-4xl font-bold">{affiliates.length}</p>
            </div>
            <div className="card-glass p-6">
              <h3 className="text-lg text-muted mb-2">Pending Payouts</h3>
              <p className="text-4xl font-bold text-orange-400">${(totalPending / 100).toFixed(2)}</p>
            </div>
            <div className="card-glass p-6">
              <h3 className="text-lg text-muted mb-2">Paid Payouts</h3>
              <p className="text-4xl font-bold text-green-400">${(totalPaid / 100).toFixed(2)}</p>
            </div>
          </div>

          <div className="card-glass p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4">All Referrals</h2>
            {referrals.length === 0 ? (
              <p className="text-muted">No referrals yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-[var(--border)]">
                    <tr>
                      <th className="pb-3 font-semibold text-muted">Date</th>
                      <th className="pb-3 font-semibold text-muted">Affiliate Code</th>
                      <th className="pb-3 font-semibold text-muted">Plan Type</th>
                      <th className="pb-3 font-semibold text-muted">Reward</th>
                      <th className="pb-3 font-semibold text-muted">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((referral) => {
                      const affiliate = affiliates.find((a) => a.id === referral.affiliate_id);
                      return (
                        <tr key={referral.id} className="border-b border-[var(--border)]/60">
                          <td className="py-3 text-muted">
                            {new Date(referral.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 text-muted">{affiliate?.affiliate_code || "N/A"}</td>
                          <td className="py-3 text-muted capitalize">{referral.plan_type}</td>
                          <td className="py-3 font-semibold">${((referral.reward_cents || 0) / 100).toFixed(2)}</td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                referral.status === "paid"
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-orange-500/20 text-orange-400"
                              }`}
                            >
                              {referral.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
