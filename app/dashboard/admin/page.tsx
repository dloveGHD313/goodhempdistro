"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type Package = {
  id: string;
  name: string;
  price_cents: number;
  [key: string]: any;
};

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [vendorPackages, setVendorPackages] = useState<Package[]>([]);
  const [consumerPackages, setConsumerPackages] = useState<Package[]>([]);
  const [affiliateStats, setAffiliateStats] = useState({ total: 0, activeReferrals: 0 });

  useEffect(() => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    async function loadData() {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      if (data.user) {
        // Load profile to check role
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();

        setProfile(profileData);

        if (profileData?.role === "admin") {
          // Load packages
          const { data: vp } = await supabase.from("vendor_packages").select("*");
          const { data: cp } = await supabase.from("consumer_packages").select("*");
          const { data: affiliates } = await supabase.from("affiliates").select("id");
          const { data: referrals } = await supabase
            .from("affiliate_referrals")
            .select("id")
            .eq("status", "paid");

          setVendorPackages(vp || []);
          setConsumerPackages(cp || []);
          setAffiliateStats({
            total: affiliates?.length || 0,
            activeReferrals: referrals?.length || 0,
          });
        }
      }

      setLoading(false);
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen text-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h1 className="text-4xl font-bold mb-4">Admin Panel</h1>
          <p className="text-gray-400">Loading...</p>
        </div>
      </main>
    );
  }

  if (!user || profile?.role !== "admin") {
    return (
      <main className="min-h-screen text-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--accent-green)" }}>
            Admin Panel
          </h1>
          <div className="card p-6">
            <p className="text-gray-300 mb-4">Access denied. Admin privileges required.</p>
            <a href="/dashboard" className="btn-primary">
              Back to Dashboard
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen text-white">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--accent-green)" }}>
          Admin Control Panel
        </h1>

        {/* Stats Overview */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <div className="card p-6">
            <h3 className="text-lg text-gray-400 mb-2">Vendor Packages</h3>
            <p className="text-3xl font-bold">{vendorPackages.length}</p>
          </div>
          <div className="card p-6">
            <h3 className="text-lg text-gray-400 mb-2">Consumer Packages</h3>
            <p className="text-3xl font-bold">{consumerPackages.length}</p>
          </div>
          <div className="card p-6">
            <h3 className="text-lg text-gray-400 mb-2">Active Affiliates</h3>
            <p className="text-3xl font-bold">{affiliateStats.total}</p>
            <p className="text-sm text-gray-400 mt-1">
              {affiliateStats.activeReferrals} paid referrals
            </p>
          </div>
        </div>

        {/* Vendor Packages */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Vendor Packages</h2>
          <div className="card p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-gray-700">
                  <tr>
                    <th className="pb-3 font-semibold text-gray-400">Name</th>
                    <th className="pb-3 font-semibold text-gray-400">Price</th>
                    <th className="pb-3 font-semibold text-gray-400">Commission</th>
                    <th className="pb-3 font-semibold text-gray-400">Max Products</th>
                    <th className="pb-3 font-semibold text-gray-400">Featured</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorPackages.map((pkg) => (
                    <tr key={pkg.id} className="border-b border-gray-800">
                      <td className="py-3 font-semibold">{pkg.name}</td>
                      <td className="py-3">${(pkg.price_cents / 100).toFixed(2)}</td>
                      <td className="py-3">{pkg.commission_percent}%</td>
                      <td className="py-3">{pkg.max_products || "Unlimited"}</td>
                      <td className="py-3">{pkg.featured_vendor ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn-primary mt-4">+ Add Vendor Package</button>
          </div>
        </section>

        {/* Consumer Packages */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Consumer Packages</h2>
          <div className="card p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-gray-700">
                  <tr>
                    <th className="pb-3 font-semibold text-gray-400">Name</th>
                    <th className="pb-3 font-semibold text-gray-400">Price</th>
                    <th className="pb-3 font-semibold text-gray-400">Loyalty Points</th>
                    <th className="pb-3 font-semibold text-gray-400">Discounts</th>
                  </tr>
                </thead>
                <tbody>
                  {consumerPackages.map((pkg) => (
                    <tr key={pkg.id} className="border-b border-gray-800">
                      <td className="py-3 font-semibold">{pkg.name}</td>
                      <td className="py-3">${(pkg.price_cents / 100).toFixed(2)}</td>
                      <td className="py-3">{pkg.monthly_loyalty_points}</td>
                      <td className="py-3">{pkg.event_discounts ? "✓" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn-primary mt-4">+ Add Consumer Package</button>
          </div>
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
          <div className="flex gap-4">
            <button className="btn-cta">View All Orders</button>
            <button className="btn-primary">Manage Affiliates</button>
            <button className="btn-primary">Export Reports</button>
          </div>
        </section>
      </div>
    </main>
  );
}
