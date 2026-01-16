"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

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
            role: "consumer",
            affiliate_code: code,
            reward_cents: 0,
          })
          .select()
          .single();
        
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
      <main className="min-h-screen text-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--accent-green)" }}>
            Affiliate Program
          </h1>
          <p className="text-gray-400">Loading...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null; // Router will redirect
  }

  return (
    <main className="min-h-screen text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--accent-green)" }}>
          Affiliate Program
        </h1>

        {/* Referral Link Section */}
        <div className="card p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">Your Referral Link</h2>
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              readOnly
              value={referralLink}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white"
            />
            <button onClick={copyLink} className="btn-primary">
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-sm text-gray-400">
            Share this link with friends. Earn rewards when they sign up and subscribe!
          </p>
        </div>

        {/* Your Rewards Section */}
        <div className="card p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4">Your Rewards</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded bg-gray-800 border border-gray-700">
              <div className="text-3xl font-bold mb-2" style={{ color: "var(--accent-green)" }}>
                $5
              </div>
              <p className="text-sm text-gray-400">STARTER Package</p>
            </div>
            <div className="p-4 rounded bg-gray-800 border border-gray-700">
              <div className="text-3xl font-bold mb-2" style={{ color: "var(--accent-orange)" }}>
                $15
              </div>
              <p className="text-sm text-gray-400">PLUS Package</p>
            </div>
            <div className="p-4 rounded bg-gray-800 border border-gray-700">
              <div className="text-3xl font-bold mb-2" style={{ color: "var(--accent-green)" }}>
                $25
              </div>
              <p className="text-sm text-gray-400">VIP Package</p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid gap-6 md:grid-cols-3 mb-6">
          <div className="card p-6">
            <h3 className="text-lg text-gray-400 mb-2">Total Referrals</h3>
            <p className="text-4xl font-bold">{earnings.totalReferrals}</p>
          </div>
          <div className="card p-6">
            <h3 className="text-lg text-gray-400 mb-2">Pending Payouts</h3>
            <p className="text-4xl font-bold text-yellow-400">{earnings.pendingReferrals}</p>
          </div>
          <div className="card p-6">
            <h3 className="text-lg text-gray-400 mb-2">Paid Payouts</h3>
            <p className="text-4xl font-bold text-green-400">{earnings.paidReferrals}</p>
          </div>
        </div>

        {/* Referral History Table */}
        <div className="card p-6">
          <h2 className="text-2xl font-bold mb-4">Referral History</h2>
          {referrals.length === 0 ? (
            <p className="text-gray-400">No referrals yet. Start sharing your link!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-gray-700">
                  <tr>
                    <th className="pb-3 font-semibold text-gray-400">Date</th>
                    <th className="pb-3 font-semibold text-gray-400">Referred User</th>
                    <th className="pb-3 font-semibold text-gray-400">Status</th>
                    <th className="pb-3 font-semibold text-gray-400">Reward</th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((referral) => (
                    <tr key={referral.id} className="border-b border-gray-800">
                      <td className="py-3 text-gray-300">{formatDate(referral.created_at)}</td>
                      <td className="py-3 text-gray-300">{maskUserId(referral.referred_user_id)}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            referral.status === "paid"
                              ? "bg-green-900 text-green-300"
                              : "bg-yellow-900 text-yellow-300"
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
    </main>
  );
}
