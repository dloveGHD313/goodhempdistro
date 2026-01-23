"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SearchInput from "@/components/discovery/SearchInput";
import FilterSelect from "@/components/discovery/FilterSelect";
import FavoriteButton from "@/components/engagement/FavoriteButton";
import RatingBadge from "@/components/engagement/RatingBadge";

type Vendor = {
  id: string;
  business_name: string;
  description?: string | null;
  categories?: string[] | null;
  tags?: string[] | null;
  state?: string | null;
  city?: string | null;
  vendor_type?: string | null;
};

type Props = {
  vendors: Vendor[];
};

function formatVendorType(value?: string | null) {
  if (!value) return "Vendor";
  return value.replace(/_/g, " ");
}

export default function VendorsDirectoryClient({ vendors }: Props) {
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});

  const normalizedVendors = useMemo(
    () =>
      vendors.map((vendor) => ({
        ...vendor,
        categories: vendor.categories || [],
        tags: vendor.tags || [],
      })),
    [vendors]
  );

  const stateOptions = useMemo(() => {
    const values = new Set(
      normalizedVendors.map((vendor) => vendor.state).filter(Boolean) as string[]
    );
    return Array.from(values)
      .sort()
      .map((value) => ({ label: value, value }));
  }, [normalizedVendors]);

  const cityOptions = useMemo(() => {
    const values = new Set(
      normalizedVendors.map((vendor) => vendor.city).filter(Boolean) as string[]
    );
    return Array.from(values)
      .sort()
      .map((value) => ({ label: value, value }));
  }, [normalizedVendors]);

  const typeOptions = useMemo(() => {
    const values = new Set(
      normalizedVendors.map((vendor) => vendor.vendor_type).filter(Boolean) as string[]
    );
    return Array.from(values)
      .sort()
      .map((value) => ({ label: formatVendorType(value), value }));
  }, [normalizedVendors]);

  const tagOptions = useMemo(() => {
    const values = new Set<string>();
    normalizedVendors.forEach((vendor) => {
      vendor.categories?.forEach((tag) => values.add(tag));
      vendor.tags?.forEach((tag) => values.add(tag));
    });
    return Array.from(values)
      .sort()
      .map((value) => ({ label: value, value }));
  }, [normalizedVendors]);

  const filteredVendors = normalizedVendors.filter((vendor) => {
    const matchesSearch =
      !search ||
      vendor.business_name.toLowerCase().includes(search.toLowerCase());
    const matchesState = !stateFilter || vendor.state === stateFilter;
    const matchesCity = !cityFilter || vendor.city === cityFilter;
    const matchesType = !typeFilter || vendor.vendor_type === typeFilter;
    const matchesTag =
      !tagFilter ||
      vendor.categories?.includes(tagFilter) ||
      vendor.tags?.includes(tagFilter);

    return matchesSearch && matchesState && matchesCity && matchesType && matchesTag;
  });

  useEffect(() => {
    if (!normalizedVendors.length) return;
    const ids = normalizedVendors.map((vendor) => vendor.id).join(",");
    fetch(`/api/reviews/summary?entity_type=vendor&entity_ids=${ids}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.summaries) {
          setRatings(data.summaries);
        }
      })
      .catch(() => undefined);

    fetch(`/api/favorites?entity_type=vendor&entity_ids=${ids}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const next = new Set<string>();
        (data?.favorites || []).forEach((fav: any) => next.add(fav.entity_id));
        setFavorites(next);
      })
      .catch(() => undefined);
  }, [normalizedVendors]);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <SearchInput
            label="Search vendors"
            placeholder="Search by vendor name..."
            value={search}
            onChange={setSearch}
          />
        </div>
        <FilterSelect
          label="State"
          value={stateFilter}
          options={stateOptions}
          placeholder="All states"
          onChange={setStateFilter}
        />
        <FilterSelect
          label="City"
          value={cityFilter}
          options={cityOptions}
          placeholder="All cities"
          onChange={setCityFilter}
        />
        <FilterSelect
          label="Vendor type"
          value={typeFilter}
          options={typeOptions}
          placeholder="All types"
          onChange={setTypeFilter}
        />
        <FilterSelect
          label="Tags"
          value={tagFilter}
          options={tagOptions}
          placeholder="All tags"
          onChange={setTagFilter}
          className="lg:col-start-1"
        />
      </div>

      {filteredVendors.length === 0 ? (
        <div className="text-center py-12 surface-card p-8">
          <p className="text-muted text-lg mb-2">No vendors match your filters.</p>
          <p className="text-muted">Try adjusting the search or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {filteredVendors.map((vendor) => {
            const rating = ratings[vendor.id];
            return (
              <div key={vendor.id} className="surface-card p-8 hover-lift h-full">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-[var(--brand-lime)] border border-[var(--brand-lime)]/40 bg-[var(--brand-lime)]/15 px-3 py-1 rounded-full">
                    Verified & Approved
                  </div>
                  {vendor.vendor_type && (
                    <span className="text-xs uppercase tracking-wide text-muted">
                      {formatVendorType(vendor.vendor_type)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between mb-4">
                  <RatingBadge average={rating?.avg ?? null} count={rating?.count ?? 0} />
                  <FavoriteButton
                    entityType="vendor"
                    entityId={vendor.id}
                    initialFavorited={favorites.has(vendor.id)}
                  />
                </div>
                <Link href={`/vendors/${vendor.id}`} className="group">
                  <div className="w-20 h-20 bg-[var(--surface)]/60 rounded-full mb-4 group-hover:bg-[var(--surface)]/80 transition flex items-center justify-center text-3xl">
                    🌿
                  </div>
                  <h3 className="text-2xl font-semibold mb-2 group-hover:text-accent transition">
                    {vendor.business_name}
                  </h3>
                  <p className="text-muted mb-3 text-sm">
                    {vendor.description || "Trusted hemp products and services."}
                  </p>
                  <div className="text-sm text-muted mb-4">
                    {[vendor.city, vendor.state].filter(Boolean).join(", ") || "Location available on profile"}
                  </div>
                  {(vendor.categories?.length || vendor.tags?.length) && (
                    <div className="flex gap-2 flex-wrap">
                      {[...(vendor.categories || []), ...(vendor.tags || [])].slice(0, 6).map((tag) => (
                        <span
                          key={tag}
                          className="bg-[var(--brand-lime)]/15 text-[var(--brand-lime)] px-3 py-1 rounded text-sm border border-[var(--brand-lime)]/40"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
