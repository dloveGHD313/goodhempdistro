import { notFound } from "next/navigation";
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
      .select(
        "id, name, title, description, pricing_type, price_cents, slug, category_id, subcategory_id, status, active, vendor_id, coa_object_path"
      )
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

    let category = null;
    if (service.category_id) {
      const { data: categoryData } = await supabase
        .from("categories")
        .select("name, slug")
        .eq("id", service.category_id)
        .maybeSingle();
      category = categoryData || null;
    }

    let vendor = null;
    if (service.vendor_id) {
      const { data: vendorData } = await supabase
        .from("vendors")
        .select("business_name")
        .eq("id", service.vendor_id)
        .eq("is_active", true)
        .eq("is_approved", true)
        .maybeSingle();
      vendor = vendorData || null;
    }

    const coaPublicUrl = service.coa_object_path
      ? supabase.storage.from("coas").getPublicUrl(service.coa_object_path).data.publicUrl
      : null;

    const normalizedService = {
      ...service,
      categories: category,
      vendors: vendor,
      coa_public_url: coaPublicUrl,
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
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="max-w-2xl mx-auto text-center">
              <h1 className="text-3xl font-bold mb-4 text-accent">Service Not Available</h1>
              <p className="text-muted mb-6">
                This service is not available or has been removed.
              </p>
              <a href="/services" className="btn-primary">
                Browse All Services
              </a>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
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
