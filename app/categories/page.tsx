import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/lib/brand";
import Footer from "@/components/Footer";
import JaxFigure from "@/components/mascot/JaxFigure";
import { CATEGORY_SHOWCASE, SHOWCASE_SLUGS, type ShowcaseGroup } from "@/lib/categoryShowcase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Hemp Product Categories | Good Hemp Distro",
  description:
    "Everything the Good Hemp Distro marketplace carries — hemp building materials, fiber, apparel, paper, home goods, food, wellness, pet, and industry services. Vendors: see what you can list.",
  openGraph: {
    title: "Hemp Product Categories | Good Hemp Distro",
    description:
      "Hemp building materials, fiber, apparel, paper, home goods, food, wellness, pet, and industry services — all in one marketplace.",
    url: `${brand.url}/categories`,
    siteName: brand.name,
    type: "website",
  },
};

type LiveCategory = { requiresCoa: boolean; hasProducts: boolean };

/** Cross-check curated slugs against production categories, and mark which
 *  already have live products. Fail-soft: on any error the static curation
 *  renders as-is with no badges. */
async function getLiveCategoryInfo(): Promise<Record<string, LiveCategory>> {
  try {
    const admin = getSupabaseAdminClient();
    const { data: cats } = await admin
      .from("categories")
      .select("id, slug, requires_coa")
      .in("slug", SHOWCASE_SLUGS);
    if (!cats) return {};
    const idsBySlug: Record<string, string[]> = {};
    for (const c of cats) {
      if (!c.slug) continue;
      (idsBySlug[c.slug] ??= []).push(c.id as string);
    }
    const allIds = cats.map((c) => c.id as string);
    const withProducts = new Set<string>();
    if (allIds.length > 0) {
      const { data: prods } = await admin
        .from("products")
        .select("category_id")
        .in("category_id", allIds)
        .eq("active", true)
        .eq("status", "approved");
      for (const p of prods ?? []) {
        if (p.category_id) withProducts.add(p.category_id as string);
      }
    }
    const out: Record<string, LiveCategory> = {};
    for (const c of cats) {
      if (!c.slug) continue;
      const prev = out[c.slug];
      out[c.slug] = {
        requiresCoa: (prev?.requiresCoa ?? false) || c.requires_coa === true,
        hasProducts: (prev?.hasProducts ?? false) || withProducts.has(c.id as string),
      };
    }
    return out;
  } catch (err) {
    console.error("[categories] live info failed:", err);
    return {};
  }
}

function GroupCard({ group, live }: { group: ShowcaseGroup; live: Record<string, LiveCategory> }) {
  // Drop curated slugs that no longer exist in the DB (only when we DID get live data).
  const haveLiveData = Object.keys(live).length > 0;
  const cats = haveLiveData
    ? group.categories.filter((c) => c.slug in live)
    : group.categories;
  if (cats.length === 0) return null;

  return (
    <article className="card-glass p-6 flex flex-col">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl" aria-hidden>
          {group.icon}
        </span>
        <h2 className="font-bold text-lg">{group.title}</h2>
      </div>
      <p className="text-sm text-muted mb-4">{group.blurb}</p>
      <ul className="flex flex-wrap gap-2 mt-auto">
        {cats.map((c) => {
          const info = live[c.slug];
          const badges = (
            <>
              {info?.hasProducts ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#3CB97A]">
                  live
                </span>
              ) : null}
              {info?.requiresCoa ? (
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide text-[#C9A84C]"
                  title="Products in this category require a Certificate of Analysis"
                >
                  COA
                </span>
              ) : null}
            </>
          );
          const pillClass =
            "inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm";
          return (
            <li key={c.slug}>
              {info?.hasProducts ? (
                <Link
                  href="/products"
                  className={`${pillClass} hover:border-[var(--brand-lime)] transition-colors`}
                >
                  {c.label}
                  {badges}
                </Link>
              ) : (
                <span className={pillClass}>
                  {c.label}
                  {badges}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export default async function CategoriesPage() {
  const live = await getLiveCategoryInfo();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell max-w-6xl mx-auto pt-10 pb-16">
          <div className="grid md:grid-cols-[1fr_auto] gap-8 items-center mb-12">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#3CB97A] mb-3">
                THE CATALOG
              </p>
              <h1 className="text-3xl md:text-5xl font-bold text-accent mb-4">
                Everything Hemp, One Marketplace
              </h1>
              <p className="text-muted max-w-2xl mb-6">
                This is what Good Hemp Distro carries as our founding vendors come aboard —
                from hempcrete and industrial fiber to everyday goods like clothing, paper,
                and pet gear. Categories marked <span className="text-[#3CB97A] font-semibold">LIVE</span> have
                products you can shop today; the rest are open lanes waiting for the right
                vendor.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/products" className="btn-primary inline-block py-3 px-6 text-center">
                  Shop what&apos;s live →
                </Link>
                <Link
                  href="/vendor-registration"
                  className="inline-block py-3 px-6 rounded-xl border border-[#C9A84C] text-[#C9A84C] font-semibold hover:bg-[#1A2820] transition text-center"
                >
                  Vendors: claim your category →
                </Link>
              </div>
            </div>
            <JaxFigure outfit="categories" width={200} className="hidden md:flex" />
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {CATEGORY_SHOWCASE.map((group) => (
              <GroupCard key={group.key} group={group} live={live} />
            ))}
          </div>

          <div className="card-glass p-6 md:p-8 mt-10 text-center">
            <h2 className="font-bold text-xl mb-2">Make or supply something hemp that isn&apos;t listed?</h2>
            <p className="text-muted max-w-xl mx-auto mb-5">
              The taxonomy grows with the network. Register as a vendor and tell us what you
              make — if it&apos;s hemp, there&apos;s a lane for it.
            </p>
            <Link href="/vendor-registration" className="btn-primary inline-block py-3 px-8">
              Become a founding vendor
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
