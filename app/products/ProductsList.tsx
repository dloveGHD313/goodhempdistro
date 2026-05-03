"use client";

import { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { getCategoriesClient, type Category } from "@/lib/categories";
import SearchInput from "@/components/discovery/SearchInput";
import FilterSelect from "@/components/discovery/FilterSelect";
import FavoriteButton from "@/components/engagement/FavoriteButton";
import RatingBadge from "@/components/engagement/RatingBadge";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { useMarketMode } from "@/lib/marketMode";

type Product = {
  id: string;
  name: string;
  category_id: string | null;
  price_cents: number;
  is_gated: boolean;
  market_category: string | null;
  market_mode?: "gated" | "ungated";
  featured: boolean;
  description?: string | null;
  vendor_name?: string | null;
  ship_to_states?: string[] | null;
};

type Props = {
  initialProducts: Product[];
  initialCategoryId?: string | null;
  /** When true, the catalogue has no approved products at all (not just filtered to zero). */
  catalogueEmpty?: boolean;
  /** User's profile.onboarding_state — used for shipping filter. */
  userState?: string | null;
};

export default function ProductsList({ initialProducts, initialCategoryId, catalogueEmpty = false, userState }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { mode, isVerified } = useMarketMode();
  const router = useRouter();
  const pathname = usePathname() || "/products";
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(initialCategoryId || "");
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});
  // shopping_interests has priority for the auto-category match. Legacy
  // consumer_interest_tags + consumer_use_case kept as a fallback so users
  // who completed onboarding before Build 10 still get pre-filtering.
  const [profileInterests, setProfileInterests] = useState<string[]>([]);
  const [interestTags, setInterestTags] = useState<string[]>([]);
  const [useCase, setUseCase] = useState<string | null>(null);
  // Default to ON for authenticated users who have a state set
  const [hideUnavailableForState, setHideUnavailableForState] = useState<boolean>(!!userState);

  // ?interests=skincare,wellness wins over profile data. Lets a user
  // share a filtered link or click "Use My Interests" without changing
  // their saved profile.
  const urlInterests = useMemo(() => {
    const raw = searchParams?.get("interests") ?? "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [searchParams]);

  useEffect(() => {
    async function loadCategories() {
      const cats = await getCategoriesClient();
      setCategories(cats);
    }
    loadCategories();
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadProfilePreferences() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("shopping_interests, consumer_interest_tags, consumer_use_case")
        .eq("id", user.id)
        .maybeSingle();
      if (!mounted) return;
      setProfileInterests((data?.shopping_interests as string[] | null) || []);
      setInterestTags((data?.consumer_interest_tags as string[] | null) || []);
      setUseCase((data?.consumer_use_case as string | null) || null);
    }
    loadProfilePreferences();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  // Resolved interest list: URL > shopping_interests > legacy fields.
  const effectiveInterests = useMemo<string[]>(() => {
    if (urlInterests.length > 0) return urlInterests;
    if (profileInterests.length > 0) return profileInterests;
    const legacy = [...interestTags, useCase || ""].filter(Boolean);
    return legacy;
  }, [urlInterests, profileInterests, interestTags, useCase]);

  useEffect(() => {
    if (selectedCategoryId || categories.length === 0) return;
    const normalized = effectiveInterests.map((value) => value.toLowerCase()).filter(Boolean);
    if (normalized.length === 0) return;
    const match = categories.find((category) =>
      normalized.some((tag) => category.name.toLowerCase().includes(tag))
    );
    if (match) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedCategoryId(match.id);
    }
  }, [categories, effectiveInterests, selectedCategoryId]);

  // "Use My Interests" — pushes shopping_interests into the URL so the
  // filter is shareable and re-applies cleanly. Visible only to users
  // who have saved interests. (TODO: tighten to paid consumers only
  // once a server-rendered eligibility prop is wired through.)
  const canUseMyInterests = profileInterests.length > 0 && urlInterests.length === 0;
  const applyMyInterests = () => {
    if (profileInterests.length === 0) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("interests", profileInterests.join(","));
    router.push(`${pathname}?${params.toString()}`);
    setSelectedCategoryId(""); // re-run the auto-match
  };

  useEffect(() => {
    if (!initialProducts.length) return;
    const ids = initialProducts.map((product) => product.id).join(",");
    fetch(`/api/reviews/summary?entity_type=product&entity_ids=${ids}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.summaries) {
          setRatings(data.summaries);
        }
      })
      .catch(() => undefined);

    fetch(`/api/favorites?entity_type=product&entity_ids=${ids}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const next = new Set<string>();
        (data?.favorites || []).forEach((fav: any) => next.add(fav.entity_id));
        setFavorites(next);
      })
      .catch(() => undefined);
  }, [initialProducts]);

  const showVerificationNotice = mode === "RECREATIONAL" && !isVerified;

  const filteredProducts = useMemo(() => {
    let filtered = initialProducts.filter((product) => {
      const gated = product.is_gated === true;
      if (mode === "RECREATIONAL" && isVerified) {
        return gated;
      }
      return !gated;
    });
    if (selectedCategoryId) {
      filtered = filtered.filter((product) => product.category_id === selectedCategoryId);
    }
    if (search) {
      filtered = filtered.filter((product) =>
        product.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (hideUnavailableForState && userState) {
      filtered = filtered.filter((product) => {
        if (!product.ship_to_states || product.ship_to_states.length === 0) return true;
        return product.ship_to_states.includes(userState);
      });
    }
    return filtered;
  }, [mode, initialProducts, isVerified, selectedCategoryId, search, hideUnavailableForState, userState]);

  return (
    <>
      {mode === "SERVICES" && (
        <div className="card-glass p-4 mb-6 border border-[var(--border)] text-muted">
          Services are listed in the Services marketplace.
          {/* FIXED: Use Link for client-side navigation */}
          <Link href="/services" className="btn-secondary ml-3 inline-flex">
            View Services
          </Link>
        </div>
      )}
      {showVerificationNotice && (
        <div className="card-glass p-4 mb-6 border border-yellow-500/40 text-yellow-200">
          <p className="text-sm">
            The recreational market requires 21+ verification. Start verification to unlock gated
            products.
          </p>
          <a href="/verify" className="btn-secondary mt-3 inline-flex">
            Start Verification
          </a>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <SearchInput
          label="Search products"
          placeholder="Search by product name..."
          value={search}
          onChange={setSearch}
        />
        <FilterSelect
          label="Category"
          value={selectedCategoryId}
          options={categories.map((cat) => ({ label: cat.name, value: cat.id }))}
          placeholder="All categories"
          onChange={setSelectedCategoryId}
        />
      </div>

      {(canUseMyInterests || urlInterests.length > 0) && (
        <div className="flex flex-wrap items-center gap-3 mb-6 text-sm">
          {urlInterests.length > 0 ? (
            <>
              <span className="text-muted">
                Filtered by your interests: {urlInterests.join(", ")}
              </span>
              <Link
                href={pathname}
                className="text-accent underline-offset-2 hover:underline"
              >
                Clear
              </Link>
            </>
          ) : (
            <button type="button" onClick={applyMyInterests} className="btn-secondary text-sm">
              Use My Interests
            </button>
          )}
        </div>
      )}

      {userState && (
        <div className="flex items-center gap-3 mb-6 text-sm">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideUnavailableForState}
              onChange={(e) => setHideUnavailableForState(e.target.checked)}
              className="w-4 h-4 accent-accent"
            />
            <span className="text-muted">
              Hide products not shipping to {userState}
            </span>
          </label>
        </div>
      )}

      {filteredProducts.length === 0 ? (
        catalogueEmpty ? (
          /* ── Case A: No approved products in DB yet ── */
          <div className="text-center py-20 px-6 card-glass p-10 max-w-2xl mx-auto">
            <p className="text-xs uppercase tracking-widest text-[#3CB97A] mb-4">
              Marketplace
            </p>
            <h2 className="text-3xl font-serif text-[#F0EDE6] mb-4">
              Products arriving soon
            </h2>
            <p className="text-[#8A9E96] max-w-md mx-auto mb-8">
              Verified hemp vendors are listing their products now.
              Be the first to know when new products are available in your area.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/vendor-registration"
                className="px-6 py-3 bg-[#3CB97A] text-[#0D1512] font-semibold rounded-lg hover:opacity-90 text-sm"
              >
                List Your Products →
              </Link>
              <Link
                href="/discover"
                className="px-6 py-3 border border-white/10 text-[#8A9E96] hover:text-[#F0EDE6] rounded-lg text-sm"
              >
                Browse Vendors →
              </Link>
            </div>
          </div>
        ) : (
          /* ── Case B/E: Products exist but filters returned zero ── */
          <div className="text-center py-16 card-glass p-8">
            <p className="text-muted text-lg mb-2">No products match your filters.</p>
            <p className="text-muted">Try adjusting the search or category.</p>
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((product) => {
            const categoryName =
              categories.find((cat) => cat.id === product.category_id)?.name || "Uncategorized";
            const rating = ratings[product.id];
            const deliveryEta = product.featured ? "30-45 min" : "50-70 min";
            const summary =
              product.description && product.description.trim().length > 0
                ? product.description.trim()
                : "Product details coming soon.";
            const marketCategory = product.market_category || "CBD_WELLNESS";
            const isRecreational =
              marketCategory === "RECREATIONAL" || marketCategory === "INTOXICATING";
            const marketMode = product.market_mode ?? (isRecreational ? "gated" : "ungated");
            const isLocked = marketMode === "gated" && !isVerified;
            return (
              <div key={product.id} className="card-glass p-6 hover-lift h-full">
              <div className="flex items-center justify-between mb-3">
                <RatingBadge average={rating?.avg ?? null} count={rating?.count ?? 0} />
                <FavoriteButton
                  entityType="product"
                  entityId={product.id}
                  initialFavorited={favorites.has(product.id)}
                />
              </div>
              {isLocked ? (
                <div className="group">
                  <div className="aspect-square bg-[var(--surface)]/60 rounded-lg mb-4" />
                  <h3 className="text-xl font-semibold mb-2">{product.name}</h3>
                  <p className="text-sm text-muted">{product.vendor_name ?? "Unknown Vendor"}</p>
                  <p className="text-muted mb-2 text-sm">{categoryName}</p>
                  <p className="text-muted text-sm mb-3">
                    {summary.length > 120 ? `${summary.slice(0, 120)}...` : summary}
                  </p>
                </div>
              ) : (
                <Link href={`/products/${product.id}`} className="group">
                  <div className="aspect-square bg-[var(--surface)]/60 rounded-lg mb-4 group-hover:bg-[var(--surface)]/80 transition" />
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-accent transition">
                    {product.name}
                  </h3>
                  <p className="text-sm text-muted">{product.vendor_name ?? "Unknown Vendor"}</p>
                  <p className="text-muted mb-2 text-sm">{categoryName}</p>
                  <p className="text-muted text-sm mb-3">
                    {summary.length > 120 ? `${summary.slice(0, 120)}...` : summary}
                  </p>
                </Link>
              )}
              <div className="flex flex-wrap gap-2 mt-4 mb-4">
                <span className="delivery-chip">🚚 {deliveryEta}</span>
                <span className="compliance-chip">✅ Compliance Ready</span>
                {isRecreational ? (
                  <span className="compliance-chip">
                    {isLocked ? "🔒 Gated" : "🔒 21+ Verified"}
                  </span>
                ) : (
                  <span className="compliance-chip">
                    {marketCategory.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center">
                {isLocked ? (
                  <>
                    <span className="text-sm text-muted">Price locked</span>
                    <span className="text-xs uppercase tracking-[0.2em] text-yellow-300">
                      Verification required
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl font-bold text-accent">
                      ${(product.price_cents / 100).toFixed(2)}
                    </span>
                    <Link href={`/products/${product.id}`} className="btn-secondary px-4 py-2 rounded-lg">
                      View
                    </Link>
                  </>
                )}
              </div>
              </div>
          );
          })}
        </div>
      )}

      <div className="mt-16 text-center">
        <p className="text-muted">
          {filteredProducts.length > 0
            ? "Browse our full selection above"
            : "More products coming soon. Check back regularly for new additions."}
        </p>
      </div>
    </>
  );
}
