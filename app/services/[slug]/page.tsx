import { redirect, notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import ServiceDetailClient from "./ServiceDetailClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getService(slugOrId: string) {
  try {
    noStore();
    const supabase = await createSupabaseServerClient();
    
    // Try by slug first, then by id
    let { data: service, error } = await supabase
      .from("services")
      .select(`
        id,
        name,
        title,
        description,
        pricing_type,
        price_cents,
        slug,
        category_id,
        subcategory_id,
        status,
        active,
        categories(name, slug),
        vendors(business_name)
      `)
      .or(`slug.eq.${slugOrId},id.eq.${slugOrId}`)
      .eq("status", "approved")
      .eq("active", true)
      .maybeSingle();

    if (error) {
      console.error("[services/[slug]] Error fetching service:", error);
      return null;
    }

    if (!service) {
      return null;
    }

    // Normalize relations
    const normalizedService = {
      ...service,
      categories: Array.isArray(service.categories) ? service.categories[0] : service.categories,
      vendors: Array.isArray(service.vendors) ? service.vendors[0] : service.vendors,
    };

    return normalizedService;
  } catch (err) {
    console.error("[services/[slug]] Error in getService:", err);
    return null;
  }
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = await getService(slug);

  if (!service) {
    notFound();
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <ServiceDetailClient service={service} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
