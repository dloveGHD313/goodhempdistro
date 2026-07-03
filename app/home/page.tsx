import { createSupabaseServerClient } from "@/lib/supabase";
import HomeMotion from "./HomeMotion";

export const dynamic = "force-dynamic";

async function getFeaturedServices() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("services")
      // services has TWO FKs to categories (category_id + subcategory_id) —
      // an unqualified categories(name) embed is ambiguous and PostgREST
      // rejects it with PGRST201, silently emptying this section.
      .select("id, name, title, description, pricing_type, price_cents, slug, categories!services_category_id_fkey(name)")
      .eq("status", "approved")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      console.error("[homepage] Error fetching services:", error);
      return [];
    }

    return (data || []).map((s: any) => ({
      ...s,
      categories: Array.isArray(s.categories) ? s.categories[0] : s.categories,
    }));
  } catch (err) {
    console.error("[homepage] Fatal error fetching services:", err);
    return [];
  }
}

export default async function HomeMarketingPage() {
  const featuredServices = await getFeaturedServices();
  return <HomeMotion featuredServices={featuredServices} />;
}
