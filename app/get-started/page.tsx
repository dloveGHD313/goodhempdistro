"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import Footer from "@/components/Footer";

type ConsumerPackage = {
  id: string;
  slug: string;
  name: string;
  stripe_price_id: string | null;
  monthly_price_cents: number;
  perks: string[];
  loyalty_points_multiplier: number;
};

function GetStartedContent() {
  const searchParams = useSearchParams();
  const [packages, setPackages] = useState<ConsumerPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [submittingPlan, setSubmittingPlan] = useState<string | null>(null);

  useEffect(() => {
    const loadPackages = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("consumer_packages")
        .select("id, slug, name, stripe_price_id, monthly_price_cents, perks, loyalty_points_multiplier")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error("Error loading consumer packages:", error);
        setPackages([]);
      } else {
        setPackages(data || []);
      }
      setLoading(false);
    };

    loadPackages();
  }, []);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const handleChoosePlan = async (packageSlug: string) => {
    setSelectedPlan(packageSlug);
    setSubmittingPlan(packageSlug);

    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase.auth.getUser();

    if (!data.user) {
      window.location.assign("/login");
      return;
    }

    try {
      const affiliateCode = searchParams?.get("ref") || "";
      const response = await fetch("/api/consumer/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageSlug, affiliateCode }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const payload = await response.json();
      if (payload.url) {
        window.location.assign(payload.url);
      }
    } catch (error) {
      console.error("Error starting consumer checkout:", error);
      setSubmittingPlan(null);
    }
  };

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-3xl mx-auto surface-card p-8 text-center">
            <h1 className="text-4xl font-bold mb-4 text-accent">Get Started</h1>
            <p className="text-muted mb-8">Create an account to access the full community and marketplace.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/login" className="btn-secondary">Login</Link>
              <Link href="/signup" className="btn-primary">Sign Up</Link>
            </div>
          </div>
        </section>

        <section className="section-shell section-shell--tight">
          <h2 className="text-3xl font-bold mb-10 text-center text-accent">
            Choose a Consumer Package
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {(loading ? [] : packages).map((pkg) => (
              <div key={pkg.id} className="surface-card p-6 text-center">
                <h3 className="text-xl font-bold mb-2">{pkg.name}</h3>
                <p className="text-3xl font-bold text-accent mb-2">
                  {formatPrice(pkg.monthly_price_cents)}
                </p>
                <p className="text-sm text-muted mb-4">
                  Loyalty multiplier: {pkg.loyalty_points_multiplier}x
                </p>
                <ul className="space-y-2 text-left mb-6">
                  {pkg.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2 text-sm text-muted">
                      <span className="text-accent">✓</span>
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => handleChoosePlan(pkg.slug)}
                  disabled={submittingPlan === pkg.slug}
                  className={selectedPlan === pkg.slug ? "btn-primary" : "btn-secondary"}
                >
                  {submittingPlan === pkg.slug
                    ? "Redirecting..."
                    : selectedPlan === pkg.slug
                      ? "Selected"
                      : "Choose Plan"}
                </button>
              </div>
            ))}
          </div>
          {!loading && packages.length === 0 && (
            <div className="surface-card p-6 text-center text-muted">
              Consumer packages are unavailable right now. Please check back soon.
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}

export default function GetStartedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen text-white flex flex-col">
          <main className="flex-1">
            <section className="section-shell">
              <div className="max-w-3xl mx-auto surface-card p-8 text-center">
                <h1 className="text-4xl font-bold mb-4 text-accent">Get Started</h1>
                <p className="text-muted">Loading...</p>
              </div>
            </section>
          </main>
          <Footer />
        </div>
      }
    >
      <GetStartedContent />
    </Suspense>
  );
}
