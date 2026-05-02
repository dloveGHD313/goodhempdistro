import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getRecommendedVendors } from "@/lib/recommendations/vendors";

export default async function RecommendedVendors() {
  let userId: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    userId = user.id;

    const vendors = await getRecommendedVendors(user.id, supabase, 5);
    if (vendors.length === 0) return null;

    return (
      <section className="section-shell pt-4 pb-2">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-semibold text-accent">
              Vendors matching your interests
            </h2>
            <Link
              href="/vendors"
              className="text-xs text-muted hover:text-white transition-colors"
            >
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {vendors.map((v) => (
              <Link
                key={v.id}
                href={`/vendors/${v.id}`}
                className="block rounded-xl border border-[var(--brand-lime)]/20 bg-[var(--surface)]/40 p-4 hover:border-[var(--brand-lime)]/60 transition-colors"
              >
                <p className="font-semibold text-[#F0EDE6] mb-1 truncate">
                  {v.business_name}
                </p>
                {v.tagline && (
                  <p className="text-xs text-muted mb-2 line-clamp-2">{v.tagline}</p>
                )}
                {v.matchedCategories.length > 0 && (
                  <p className="text-xs text-[var(--brand-lime)]/80">
                    {v.matchedCategories.slice(0, 2).join(" · ")}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  } catch {
    return null;
  } finally {
    void userId;
  }
}
