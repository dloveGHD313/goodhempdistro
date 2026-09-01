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

// Build #7 (community feed prominence): latest posts teaser for the homepage.
// Fails soft — RLS or query errors just render the join-CTA card instead.
async function getLatestCommunityPosts() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("posts")
      .select("id, content, created_at, is_admin_post, author_role, author_id")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(3);
    if (error || !data) return [];

    const authorIds = Array.from(
      new Set(data.map((p) => p.author_id).filter((id): id is string => typeof id === "string"))
    );
    const names: Record<string, string> = {};
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", authorIds);
      (profiles || []).forEach((p) => {
        if (p?.id && typeof p.display_name === "string" && p.display_name.trim()) {
          names[p.id] = p.display_name.trim();
        }
      });
    }

    return data.map((p) => ({
      id: p.id as string,
      content: (p.content as string) || "",
      created_at: p.created_at as string,
      is_admin_post: Boolean(p.is_admin_post),
      author_role: (p.author_role as string) || null,
      author_name: (p.author_id && names[p.author_id]) || null,
    }));
  } catch (err) {
    console.error("[homepage] Error fetching community posts:", err);
    return [];
  }
}

export default async function HomeMarketingPage() {
  const [featuredServices, communityPosts] = await Promise.all([
    getFeaturedServices(),
    getLatestCommunityPosts(),
  ]);
  return <HomeMotion featuredServices={featuredServices} communityPosts={communityPosts} />;
}
