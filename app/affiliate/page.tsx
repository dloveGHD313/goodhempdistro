"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type Referral = {
  id: string;
  referred_user_id: string;
  status: "pending" | "paid";
  created_at: string;
};

export default function AffiliatePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [affiliateCode, setAffiliateCode] = useState<string>("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [earnings, setEarnings] = useState({
    totalReferrals: 0,
    paidReferrals: 0,
    pendingReferrals: 0,
    totalEarnings: 0,
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      
      if (!data.user) {
        // Redirect to login if not authenticated
        router.push("/login");
        return;
      }

      setUser(data.user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      // Load or create affiliate
      const { data: affiliate } = await supabase
        .from("affiliates")
        .select("*")
        .eq("user_id", data.user.id)
        .single();

      if (!affiliate) {
        // Create affiliate on first visit
        const code = `${data.user.id.slice(0, 8).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const { data: newAffiliate } = await supabase
          .from("affiliates")
          .insert({
            user_id: data.user.id,
            role: profile?.role === "vendor" ? "vendor" : "affiliate",
            affiliate_code: code,
            reward_cents: 0,
          })
          .select()
          .single();

        if (profile?.role !== "vendor" && profile?.role !== "admin") {
          await supabase
            .from("profiles")
            .upsert({
              id: data.user.id,
              role: "affiliate",
              updated_at: new Date().toISOString(),
            }, { onConflict: "id" });
        }
        
        setAffiliateCode(code);
        setReferrals([]);
      } else {
        setAffiliateCode(affiliate.affiliate_code);

        // Load referrals with details
        const { data: referralData } = await supabase
          .from("affiliate_referrals")
          .select("id, referred_user_id, status, created_at")
          .eq("affiliate_id", affiliate.id)
          .order("created_at", { ascending: false });

        const referralList = referralData || [];
        setReferrals(referralList);

        const paid = referralList.filter((r) => r.status === "paid").length;
        const pending = referralList.filter((r) => r.status === "pending").length;

        setEarnings({
          totalReferrals: referralList.length,
          paidReferrals: paid,
          pendingReferrals: pending,
          totalEarnings: affiliate.reward_cents,
        });
      }

      setLoading(false);
    }

    loadUser();
  }, [router]);

  const referralLink = affiliateCode
    ? `${siteUrl}/?ref=${affiliateCode}`
    : "";

  const copyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const maskUserId = (userId: string) => {
    return `${userId.slice(0, 8)}...`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getRewardAmount = (status: string) => {
    // Default reward for display purposes
    return status === "paid" ? "$5.00" : "Pending";
  };

  if (loading) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-4xl font-bold mb-4 text-accent">Affiliate Program</h1>
              <p className="text-muted">Loading...</p>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return null; // Router will redirect
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-bold mb-4 text-accent">Affiliate Program</h1>

            <div className="surface-card p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4">Your Referral Link</h2>
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <input
                  type="text"
                  readOnly
                  value={referralLink}
                  className="flex-1 px-4 py-2 bg-[var(--surface)]/70 border border-[var(--border)] rounded text-white"
                />
                <button onClick={copyLink} className="btn-secondary">
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-sm text-muted">
                Share this link with friends. Earn rewards when they sign up and subscribe!
              </p>
            </div>

            <div className="surface-card p-6 mb-6">
              <h2 className="text-2xl font-bold mb-4">Your Rewards</h2>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="surface-card p-4">
                  <div className="text-3xl font-bold mb-2 text-accent">$5</div>
                  <p className="text-sm text-muted">STARTER Package</p>
                </div>
                <div className="surface-card p-4">
                  <div className="text-3xl font-bold mb-2 text-accent-orange">$15</div>
                  <p className="text-sm text-muted">PLUS Package</p>
                </div>
                <div className="surface-card p-4">
                  <div className="text-3xl font-bold mb-2 text-accent">$25</div>
                  <p className="text-sm text-muted">VIP Package</p>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3 mb-6">
              <div className="surface-card p-6">
                <h3 className="text-lg text-muted mb-2">Total Referrals</h3>
                <p className="text-4xl font-bold">{earnings.totalReferrals}</p>
              </div>
              <div className="surface-card p-6">
                <h3 className="text-lg text-muted mb-2">Pending Payouts</h3>
                <p className="text-4xl font-bold text-accent-orange">{earnings.pendingReferrals}</p>
              </div>
              <div className="surface-card p-6">
                <h3 className="text-lg text-muted mb-2">Paid Payouts</h3>
                <p className="text-4xl font-bold text-accent">{earnings.paidReferrals}</p>
              </div>
            </div>

            <div className="surface-card p-6">
              <h2 className="text-2xl font-bold mb-4">Referral History</h2>
              {referrals.length === 0 ? (
                <p className="text-muted">No referrals yet. Start sharing your link!</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="border-b border-[var(--border)]">
                      <tr>
                        <th className="pb-3 font-semibold text-muted">Date</th>
                        <th className="pb-3 font-semibold text-muted">Referred User</th>
                        <th className="pb-3 font-semibold text-muted">Status</th>
                        <th className="pb-3 font-semibold text-muted">Reward</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referrals.map((referral) => (
                        <tr key={referral.id} className="border-b border-[var(--border)]/60">
                          <td className="py-3 text-muted">{formatDate(referral.created_at)}</td>
                          <td className="py-3 text-muted">{maskUserId(referral.referred_user_id)}</td>
                          <td className="py-3">
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold border ${
                                referral.status === "paid"
                                  ? "bg-[var(--brand-lime)]/15 text-[var(--brand-lime)] border-[var(--brand-lime)]/40"
                                  : "bg-[var(--brand-orange)]/15 text-[var(--brand-orange)] border-[var(--brand-orange)]/40"
                              }`}
                            >
                              {referral.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 font-semibold">{getRewardAmount(referral.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
