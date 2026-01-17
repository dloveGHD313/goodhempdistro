import Link from "next/link";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Vendors | Good Hemp Distro",
  description: "Meet our trusted hemp product vendors",
};

type Vendor = {
  id: string;
  name: string;
  description?: string;
  specialties?: string;
};

async function getVendors(): Promise<Vendor[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("vendors")
      .select("id, name, description, specialties")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching vendors:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Fatal error fetching vendors:", err);
    return [];
  }
}

function VendorSkeleton() {
  return (
    <div className="surface-card p-8 animate-pulse">
      <div className="w-24 h-24 bg-[var(--surface)]/60 rounded-full mb-4" />
      <div className="h-6 bg-[var(--surface)]/60 rounded mb-2" />
      <div className="h-4 bg-[var(--surface)]/60 rounded mb-4" />
      <div className="flex gap-2">
        <div className="h-6 bg-[var(--surface)]/60 rounded w-20" />
        <div className="h-6 bg-[var(--surface)]/60 rounded w-20" />
      </div>
    </div>
  );
}

export default async function VendorsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  let hasAccess = profile?.role === "vendor" || profile?.role === "admin";

  if (!hasAccess) {
    const { data: activeSubscription } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("package_type", "consumer")
      .in("status", ["active", "trialing"])
      .maybeSingle();

    hasAccess = !!activeSubscription;
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="surface-card p-8 text-center">
              <h1 className="text-3xl font-bold mb-4 text-accent">Membership Required</h1>
              <p className="text-muted mb-6">
                Upgrade to a consumer plan to browse vendors.
              </p>
              <a href="/get-started" className="btn-primary inline-block">
                View Consumer Plans
              </a>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  const vendors = await getVendors();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-6 text-accent">Our Vendors</h1>
          <p className="text-muted mb-12">
            We partner with trusted vendors to bring you the highest quality hemp products.
          </p>

          {vendors.length === 0 ? (
            <div className="text-center py-12 surface-card p-8">
              <p className="text-muted text-lg mb-2">No vendors available at the moment.</p>
              <p className="text-muted">Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
              {vendors.map((vendor) => (
                <Link key={vendor.id} href={`/vendors/${vendor.id}`} className="group">
                  <div className="surface-card p-8 hover-lift h-full cursor-pointer">
                    <div className="w-24 h-24 bg-[var(--surface)]/60 rounded-full mb-4 group-hover:bg-[var(--surface)]/80 transition mx-auto flex items-center justify-center text-4xl">
                      🌿
                    </div>
                    <h3 className="text-2xl font-semibold mb-2 text-center group-hover:text-accent transition">{vendor.name}</h3>
                    <p className="text-muted mb-4 text-center text-sm">
                      {vendor.description || "Premium hemp products"}
                    </p>
                    {vendor.specialties && (
                      <div className="flex gap-2 flex-wrap justify-center">
                        {vendor.specialties.split(",").map((specialty) => (
                          <span
                            key={specialty.trim()}
                            className="bg-[var(--brand-lime)]/15 text-[var(--brand-lime)] px-3 py-1 rounded text-sm border border-[var(--brand-lime)]/40"
                          >
                            {specialty.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="surface-card p-8">
            <h2 className="text-2xl font-bold mb-4">Become a Vendor</h2>
            <p className="text-muted mb-6">
              Interested in partnering with Good Hemp Distro? We're always looking for 
              high-quality vendors who share our commitment to excellence.
            </p>
            <button className="btn-primary">
              Apply Now
            </button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
