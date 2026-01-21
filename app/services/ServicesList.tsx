"use client";

import { useState } from "react";
import Link from "next/link";

type Service = {
  id: string;
  name?: string;
  title: string;
  description?: string;
  pricing_type?: string;
  price_cents?: number;
  slug?: string;
  category_id?: string;
  categories?: {
    name: string;
  } | null;
};

type Props = {
  initialServices: Service[];
};

export default function ServicesList({ initialServices }: Props) {
  const [services] = useState<Service[]>(initialServices);
  const [filter, setFilter] = useState<string>("");

  const filteredServices = services.filter(service => {
    if (!filter) return true;
    const searchTerm = filter.toLowerCase();
    return (
      (service.name || service.title).toLowerCase().includes(searchTerm) ||
      service.description?.toLowerCase().includes(searchTerm) ||
      service.categories?.name?.toLowerCase().includes(searchTerm)
    );
  });

  const formatPrice = (pricingType?: string, priceCents?: number) => {
    if (!pricingType || pricingType === 'quote_only') {
      return "Quote Only";
    }
    if (!priceCents) {
      return "Price TBD";
    }
    return `$${((priceCents || 0) / 100).toFixed(2)} ${pricingType === 'hourly' ? '/hr' : pricingType === 'per_project' ? '/project' : ''}`;
  };

  if (services.length === 0) {
    return (
      <div className="card-glass p-8 text-center">
        <p className="text-muted">No services available at this time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search services..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
        />
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map((service) => (
          <div
            key={service.id}
            className="card-glass p-6 hover:border-accent transition-colors flex flex-col"
          >
            <Link href={`/services/${service.slug || service.id}`} className="flex-1">
              <h3 className="text-xl font-semibold mb-2">{service.name || service.title}</h3>
              {service.description && (
                <p className="text-muted text-sm mb-4 line-clamp-3">{service.description}</p>
              )}
              {service.pricing_type && (
                <div className="text-accent font-semibold mt-4">
                  {formatPrice(service.pricing_type, service.price_cents)}
                </div>
              )}
              {service.categories?.name && (
                <div className="text-xs text-muted mt-2">{service.categories.name}</div>
              )}
            </Link>
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <Link
                href={`/services/${service.slug || service.id}`}
                className="btn-primary w-full text-center block"
              >
                Request Quote
              </Link>
            </div>
          </div>
        ))}
      </div>

      {filteredServices.length === 0 && filter && (
        <div className="card-glass p-8 text-center">
          <p className="text-muted">No services match your search.</p>
        </div>
      )}
    </div>
  );
}
