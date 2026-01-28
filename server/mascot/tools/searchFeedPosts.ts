export type MascotPostResult = {
  title: string;
  subtitle?: string | null;
  href: string;
  meta?: string | null;
};

export async function searchFeedPosts(): Promise<MascotPostResult[]> {
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("posts")
      .select("id, content, author_role, author_tier, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error || !data) {
      return [];
    }

    return data.map((post) => {
      const content = (post.content || "").trim().replace(/\s+/g, " ");
      const title = content.length > 80 ? `${content.slice(0, 77)}...` : content || "New community post";
      const roleLabel =
        post.author_role === "vendor"
          ? "Vendor update"
          : post.author_role === "admin"
            ? "Official update"
            : post.author_role === "affiliate"
              ? "Affiliate update"
              : post.author_role === "driver"
                ? "Driver update"
                : "Community post";
      const tierLabel =
        post.author_tier && post.author_tier !== "none"
          ? ` · ${post.author_tier.toUpperCase()}`
          : "";

      return {
        title,
        subtitle: `${roleLabel}${tierLabel}`,
        href: "/newsfeed",
        meta: new Date(post.created_at).toLocaleDateString(),
      };
    });
  } catch (error) {
    console.error("[mascot] searchFeedPosts error", error);
    return [];
  }
}
