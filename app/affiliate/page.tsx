"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function AffiliatePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [affiliateCode, setAffiliateCode] = useState<string>("");
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
      setUser(data.user);

      if (data.user) {
        // Load or create affiliate
        const { data: affiliate } = await supabase
          .from("affiliates")
          .select("*")
          .eq("user_id", data.user.id)
          .single();

        if (!affiliate) {
          // Create affiliate
          const code = `${data.user.id.slice(0, 8).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          await supabase.from("affiliates").insert({
            user_id: data.user.id,
            role: "consumer",
            affiliate_code: code,
            reward_cents: 0,
          });
          setAffiliateCode(code);
        } else {
          setAffiliateCode(affiliate.affiliate_code);

          // Load referrals
          const { data: referrals } = await supabase
            .from("affiliate_referrals")
            .select("*")
            .eq("affiliate_id", affiliate.id);

          const paid = referrals?.filter((r) => r.status === "paid").length || 0;
          const pending = referrals?.filter((r) => r.status === "pending").length || 0;

          setEarnings({
            totalReferrals: referrals?.length || 0,
            paidReferrals: paid,
            pendingReferrals: pending,
            totalEarnings: affiliate.reward_cents,
          });
        }
      }

      setLoading(false);
    }

    loadUser();
  }, []);

  const referralLink = affiliateCode
    ? `${window.location.origin}/signup?ref=${affiliateCode}`
    : "";

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    return (
      <main className="min-h-screen text-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--accent-green)" }}>
            Affiliate Program
          </h1>
          <div className="card p-6">
            <p className="text-gray-300 mb-4">
              Earn rewards by referring friends and vendors.
            </p>
            <div className="flex gap-4">
              <a href="/login" className="btn-primary">
                Login
              </a>
              <a href="/get-started" className="btn-cta">
                Get Started
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--accent-green)" }}>
          Affiliate Program
        </h1>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="card p-6">
            <h2 className="text-2xl font-bold mb-4">Your Referral Link</h2>
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white"
              />
              <button onClick={copyLink} className="btn-primary">
                {copied ? "✓ Copied" : "Copy"}
              </button>
            </div>
            <p className="text-sm text-gray-400">
              Share this link with friends. Earn <strong>$5-$25</strong> per signup depending on their package tier.
            </p>
          </div>

          <div className="card p-6">
            <h2 className="text-2xl font-bold mb-4">Earnings Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Referrals:</span>
                <span className="font-bold">{earnings.totalReferrals}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Paid:</span>
                <span className="font-bold text-green-400">{earnings.paidReferrals}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Pending:</span>
                <span className="font-bold text-yellow-400">{earnings.pendingReferrals}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-gray-700">
                <span className="text-gray-400">Total Earnings:</span>
                <span className="font-bold text-xl" style={{ color: "var(--accent-green)" }}>
                  ${(earnings.totalEarnings / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6 mt-6">
          <h2 className="text-2xl font-bold mb-4">How It Works</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-300">
            <li>Share your unique referral link with friends or on social media</li>
            <li>When someone signs up using your link, they're tracked as your referral</li>
            <li>Once they purchase a subscription package, you earn a reward</li>
            <li>Rewards: <strong>STARTER ($5)</strong>, <strong>PLUS ($15)</strong>, <strong>VIP ($25)</strong></li>
          </ol>
        </div>
      </div>
    </main>
  );
}
