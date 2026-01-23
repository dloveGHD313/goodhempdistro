import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import Footer from "@/components/Footer";
import { getDiscoveryRecommendations } from "@/lib/recommendations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export default async function DiscoverPage() {
  noStore();
  const { viewerProfile, vendors, products, services, events, education, isAuthenticated, error } =
    await getDiscoveryRecommendations(6);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell space-y-10">
          <header className="space-y-3">
            <h1 className="text-4xl font-bold text-accent">Discover</h1>
            <p className="text-muted">
              Find vendors, products, services, and events tailored to your region.
            </p>
          </header>

          {error && (
            <div className="card-glass p-4 border border-red-500/40 text-red-300">
              {error}
            </div>
          )}

          {!isAuthenticated && (
            <div className="card-glass p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Personalize your discovery</h2>
                <p className="text-muted text-sm">
                  Create an account to unlock local recommendations and alerts.
                </p>
              </div>
              <Link className="btn-primary" href="/signup">
                Get started
              </Link>
            </div>
          )}

          {isAuthenticated && viewerProfile?.state && (
            <div className="card-glass p-4 text-sm text-muted">
              Showing recommendations for{" "}
              <span className="text-white font-semibold">
                {viewerProfile.city ? `${viewerProfile.city}, ` : ""}
                {viewerProfile.state}
              </span>
              .
            </div>
          )}

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Near you: vendors</h2>
              <Link href="/vendors" className="text-accent text-sm">
                View all
              </Link>
            </div>
            {vendors.length === 0 ? (
              <div className="card-glass p-6 text-muted">
                No approved vendors are available in your area yet.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {vendors.map((vendor) => (
                  <div key={vendor.id} className="card-glass p-5">
                    <h3 className="text-lg font-semibold">{vendor.business_name}</h3>
                    <p className="text-muted text-sm mt-2">
                      {vendor.description || "Verified vendor in the marketplace."}
                    </p>
                    <div className="text-xs text-muted mt-3">
                      {[vendor.city, vendor.state].filter(Boolean).join(", ") || "Nationwide"}
                    </div>
                    <div className="mt-4">
                      <Link className="btn-secondary" href={`/vendors/${vendor.id}`}>
                        View profile
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Recommended services</h2>
              <Link href="/services" className="text-accent text-sm">
                Browse services
              </Link>
            </div>
            {services.length === 0 ? (
              <div className="card-glass p-6 text-muted">
                No approved services nearby yet.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => (
                  <div key={service.id} className="card-glass p-5">
                    <h3 className="text-lg font-semibold">{service.title}</h3>
                    <p className="text-muted text-sm mt-2">
                      {service.description || "Approved service ready to request."}
                    </p>
                    <div className="mt-4">
                      <Link className="btn-secondary" href={`/services/${service.id}`}>
                        Learn more
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Recommended products</h2>
              <Link href="/products" className="text-accent text-sm">
                Browse products
              </Link>
            </div>
            {products.length === 0 ? (
              <div className="card-glass p-6 text-muted">
                No approved products are available in this region yet.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <div key={product.id} className="card-glass p-5">
                    <h3 className="text-lg font-semibold">{product.name}</h3>
                    <p className="text-muted text-sm mt-2">
                      {product.description || "Approved product available for purchase."}
                    </p>
                    <div className="mt-4">
                      <Link className="btn-secondary" href={`/products/${product.id}`}>
                        View product
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Events near you</h2>
              <Link href="/events" className="text-accent text-sm">
                Browse events
              </Link>
            </div>
            {events.length === 0 ? (
              <div className="card-glass p-6 text-muted">
                No published events nearby yet.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => (
                  <div key={event.id} className="card-glass p-5">
                    <h3 className="text-lg font-semibold">{event.title}</h3>
                    <p className="text-muted text-sm mt-2">
                      {event.description || "Live event hosted by a verified vendor."}
                    </p>
                    <div className="text-xs text-muted mt-3">{event.location || "Location TBA"}</div>
                    <div className="mt-4">
                      <Link className="btn-secondary" href={`/events/${event.id}`}>
                        View event
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Education for your state</h2>
            {education.length === 0 ? (
              <div className="card-glass p-6 text-muted">
                Education resources are coming soon.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {education.map((resource) => (
                  <div key={resource.id} className="card-glass p-5">
                    <h3 className="text-lg font-semibold">{resource.title}</h3>
                    <p className="text-muted text-sm mt-2">
                      {resource.summary || "Educational overview coming soon."}
                    </p>
                    {resource.url && (
                      <div className="mt-4">
                        <Link className="btn-secondary" href={resource.url}>
                          Learn more
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>
      </main>
      <Footer />
    </div>
  );
}
