"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function AffiliatePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [affiliateCode, setAffiliateCode] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

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
        const code = `${data.user.id.slice(0, 8).toUpperCase()}-${Math.random()
          .toString(36)
          .substring(2, 6)
          .toUpperCase()}`;
        const { data: newAffiliate } = await supabase
          .from("affiliates")
          .insert({
            user_id: data.user.id,
            affiliate_code: code,
            status: "active",
          })
          .select()
          .single();

        setAffiliateCode(code);
      } else {
        setAffiliateCode(affiliate.affiliate_code);
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
                Share this link with friends so they can join the Good Hemp community.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
