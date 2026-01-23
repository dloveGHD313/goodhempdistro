"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SearchInput from "@/components/discovery/SearchInput";
import FilterSelect from "@/components/discovery/FilterSelect";

type Service = {
  id: string;
  title: string;
  description?: string;
  pricing?: string | null;
  created_at?: string;
  updated_at?: string;
  status?: string;
};

type Props = {
  initialServices: Service[];
};

export default function ServicesList({ initialServices }: Props) {
  const [services] = useState<Service[]>(initialServices);
  const [filter, setFilter] = useState<string>("");
  const [pricingFilter, setPricingFilter] = useState<string>("");

  const filteredServices = services.filter((service) => {
    if (!filter) return true;
    const searchTerm = filter.toLowerCase();
    return (
      service.title.toLowerCase().includes(searchTerm) ||
      service.description?.toLowerCase().includes(searchTerm)
    );
  });

  const filteredByPricing = filteredServices.filter((service) => {
    if (!pricingFilter) return true;
    const pricingValue = service.pricing || "quote_only";
    return pricingValue === pricingFilter;
  });

  const formatPricing = (pricing?: string | null) => {
    if (!pricing || pricing === "quote_only") {
      return "Quote Only";
    }
    if (pricing === "hourly") return "Hourly";
    if (pricing === "per_project") return "Per Project";
    if (pricing === "flat_fee") return "Flat Fee";
    return pricing;
  };

  const pricingOptions = useMemo(() => {
    const values = new Set(
      services.map((service) => service.pricing || "quote_only")
    );
    return Array.from(values).map((value) => ({
      value,
      label: formatPricing(value),
    }));
  }, [services]);

  if (services.length === 0) {
    return (
      <div className="card-glass p-8 text-center">
        <p className="text-muted">No services available at this time.</p>
      </div>
    );
  }

  return (
      <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SearchInput
          label="Search services"
          placeholder="Search by title or description..."
          value={filter}
          onChange={setFilter}
        />
        <FilterSelect
          label="Pricing"
          value={pricingFilter}
          options={pricingOptions}
          placeholder="All pricing"
          onChange={setPricingFilter}
        />
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredByPricing.map((service) => (
          <div
            key={service.id}
            className="card-glass p-6 hover:border-accent transition-colors flex flex-col"
          >
            <Link href={`/services/${service.id}`} className="flex-1">
              <h3 className="text-xl font-semibold mb-2">{service.title}</h3>
              {service.description && (
                <p className="text-muted text-sm mb-4 line-clamp-3">{service.description}</p>
              )}
              <div className="text-accent font-semibold mt-4">
                {formatPricing(service.pricing)}
              </div>
            </Link>
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <Link
                href={`/services/${service.id}`}
                className="btn-primary w-full text-center block"
              >
                Request Quote
              </Link>
            </div>
          </div>
        ))}
      </div>

      {filteredByPricing.length === 0 && (filter || pricingFilter) && (
        <div className="card-glass p-8 text-center">
          <p className="text-muted">No services match your filters.</p>
        </div>
      )}
    </div>
  );
}
