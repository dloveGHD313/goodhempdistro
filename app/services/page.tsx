import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import ServicesList from "./ServicesList";
import MarketSwitcher from "@/components/market/MarketSwitcher";

export const metadata: Metadata = {
  title: "Services | Good Hemp Distro",
  description: "Browse professional hemp industry services",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Service = {
  id: string;
  title: string;
  description?: string;
  pricing?: string | null;
  created_at?: string;
  updated_at?: string;
  status?: string;
};

async function getServices(
  vendorId?: string | null
): Promise<{ services: Service[]; errorMessage?: string; vendorName?: string | null }> {
  try {
    noStore();
    const supabase = await createSupabaseServerClient();
    let vendorName: string | null = null;
    if (vendorId) {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, business_name")
        .eq("id", vendorId)
        .eq("is_active", true)
        .eq("is_approved", true)
        .maybeSingle();

      if (!vendor) {
        return { services: [], vendorName: null };
      }
      vendorName = vendor.business_name;
    }

    // Only fetch approved services for public view
    const baseQuery = supabase
      .from("services")
      .select("id, title, description, pricing:pricing_type, created_at, updated_at, status")
      .eq("status", "approved")
      .eq("active", true)
      .order("updated_at", { ascending: false });

    const { data, error } = vendorId
      ? await baseQuery.eq("vendor_id", vendorId)
      : await baseQuery;

    if (error) {
      console.error("[services] Error fetching services:", error);
      return { services: [], errorMessage: "Unable to load services right now.", vendorName };
    }

    return { services: (data || []) as Service[], vendorName };
  } catch (err) {
    console.error("[services] Fatal error fetching services:", err);
    return { services: [], errorMessage: "Unable to load services right now." };
  }
}

export default async function ServicesPage({
  searchParams,
}: {
  searchParams?: { vendor?: string };
}) {
  const vendorId = searchParams?.vendor || null;
  const { services, errorMessage, vendorName } = await getServices(vendorId);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-6">
            <div>
              <h1 className="text-4xl font-bold mb-3 text-accent">
                {vendorName ? `Services from ${vendorName}` : "Services"}
              </h1>
              <p className="text-muted">
                {vendorName
                  ? "Explore approved services from this vendor."
                  : "Find professional services for your hemp business needs."}
              </p>
            </div>
            <MarketSwitcher />
          </div>

          {errorMessage && (
            <div className="card-glass p-4 mb-6 border border-red-500/40 text-red-300">
              {errorMessage}
            </div>
          )}

          <ServicesList initialServices={services} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
