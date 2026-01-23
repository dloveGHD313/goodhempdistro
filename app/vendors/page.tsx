import { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import VendorsDirectoryClient from "./VendorsDirectoryClient";

export const metadata: Metadata = {
  title: "Vendors | Good Hemp Distro",
  description: "Meet our trusted hemp product vendors",
};

// Force dynamic rendering for live filters
export const dynamic = 'force-dynamic';

type Vendor = {
  id: string;
  business_name: string;
  description?: string | null;
  categories?: string[] | null;
  tags?: string[] | null;
  state?: string | null;
  city?: string | null;
  vendor_type?: string | null;
};

async function getVendors(): Promise<Vendor[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("vendors")
      .select("id, business_name, description, categories, tags, state, city, vendor_type")
      .eq("is_active", true)
      .eq("is_approved", true)
      .order("business_name", { ascending: true });

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
            <VendorsDirectoryClient vendors={vendors} />
          )}

          <div className="surface-card p-8">
            <h2 className="text-2xl font-bold mb-4">Become a Vendor</h2>
            <p className="text-muted mb-6">
              Interested in partnering with Good Hemp Distro? We're always looking for 
              high-quality vendors who share our commitment to excellence.
            </p>
            <a href="/vendor-registration" className="btn-primary">
              Apply Now
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
