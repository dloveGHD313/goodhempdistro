import { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import ServicesList from "./ServicesList";

export const metadata: Metadata = {
  title: "Services | Good Hemp Distro",
  description: "Browse professional hemp industry services",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Service = {
  id: string;
  name?: string;
  title: string;
  description?: string;
  pricing_type?: string;
  price_cents?: number;
  slug?: string;
  category_id?: string;
  categories?: {
    name: string;
  } | null;
};

async function getServices(): Promise<Service[]> {
  try {
    noStore();
    const supabase = await createSupabaseServerClient();
    // Only fetch approved and active services for public view
    const { data, error } = await supabase
      .from("services")
      .select("id, name, title, description, pricing_type, price_cents, slug, category_id, categories(name)")
      .eq("status", "approved") // Only approved services
      .eq("active", true) // Only active services
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[services] Error fetching services:", error);
      return [];
    }

    // Normalize categories relation (handle array)
    const normalizedServices = (data || []).map((s: any) => ({
      ...s,
      categories: Array.isArray(s.categories) ? s.categories[0] : s.categories,
    }));

    return normalizedServices;
  } catch (err) {
    console.error("[services] Fatal error fetching services:", err);
    return [];
  }
}

export default async function ServicesPage() {
  const services = await getServices();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-6 text-accent">Services</h1>
          <p className="text-muted mb-12">
            Find professional services for your hemp business needs.
          </p>

          <ServicesList initialServices={services} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
