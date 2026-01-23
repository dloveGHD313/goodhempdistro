import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

type Favorite = {
  entity_type: "vendor" | "product" | "service" | "event";
  entity_id: string;
};

export default async function FavoritesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/account/favorites");
  }

  const { data: favorites } = await supabase
    .from("favorites")
    .select("entity_type, entity_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const grouped: Record<string, string[]> = {
    vendor: [],
    product: [],
    service: [],
    event: [],
  };

  (favorites || []).forEach((fav: Favorite) => {
    grouped[fav.entity_type]?.push(fav.entity_id);
  });

  const [vendorsRes, productsRes, servicesRes, eventsRes] = await Promise.all([
    grouped.vendor.length
      ? supabase
          .from("vendors")
          .select("id, business_name, state, city, vendor_type")
          .in("id", grouped.vendor)
      : Promise.resolve({ data: [] }),
    grouped.product.length
      ? supabase
          .from("products")
          .select("id, name, price_cents")
          .in("id", grouped.product)
      : Promise.resolve({ data: [] }),
    grouped.service.length
      ? supabase
          .from("services")
          .select("id, title, pricing_type")
          .in("id", grouped.service)
      : Promise.resolve({ data: [] }),
    grouped.event.length
      ? supabase
          .from("events")
          .select("id, title, start_time, location")
          .in("id", grouped.event)
      : Promise.resolve({ data: [] }),
  ]);

  const vendors = vendorsRes.data || [];
  const products = productsRes.data || [];
  const services = servicesRes.data || [];
  const events = eventsRes.data || [];

  const hasFavorites =
    vendors.length || products.length || services.length || events.length;

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-4xl font-bold text-accent">My Favorites</h1>
            <Link href="/account" className="btn-secondary">
              Back to Account
            </Link>
          </div>

          {!hasFavorites ? (
            <div className="card-glass p-8 text-center">
              <p className="text-muted text-lg mb-2">You have no favorites yet.</p>
              <p className="text-muted">Browse the marketplace and tap “Save” to bookmark items.</p>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="surface-card p-6">
                <h2 className="text-2xl font-semibold mb-4">Vendors</h2>
                {vendors.length === 0 ? (
                  <p className="text-muted">No vendor favorites yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {vendors.map((vendor: any) => (
                      <Link key={vendor.id} href={`/vendors/${vendor.id}`} className="card-glass p-4 hover-lift">
                        <div className="font-semibold">{vendor.business_name}</div>
                        <div className="text-sm text-muted">
                          {[vendor.city, vendor.state].filter(Boolean).join(", ") || "Location available on profile"}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="surface-card p-6">
                <h2 className="text-2xl font-semibold mb-4">Products</h2>
                {products.length === 0 ? (
                  <p className="text-muted">No product favorites yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {products.map((product: any) => (
                      <Link key={product.id} href={`/products/${product.id}`} className="card-glass p-4 hover-lift">
                        <div className="font-semibold">{product.name}</div>
                        <div className="text-sm text-muted">
                          ${((product.price_cents || 0) / 100).toFixed(2)}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="surface-card p-6">
                <h2 className="text-2xl font-semibold mb-4">Services</h2>
                {services.length === 0 ? (
                  <p className="text-muted">No service favorites yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {services.map((service: any) => (
                      <Link key={service.id} href={`/services/${service.id}`} className="card-glass p-4 hover-lift">
                        <div className="font-semibold">{service.title}</div>
                        <div className="text-sm text-muted">{service.pricing_type || "Quote only"}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="surface-card p-6">
                <h2 className="text-2xl font-semibold mb-4">Events</h2>
                {events.length === 0 ? (
                  <p className="text-muted">No event favorites yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {events.map((event: any) => (
                      <Link key={event.id} href={`/events/${event.id}`} className="card-glass p-4 hover-lift">
                        <div className="font-semibold">{event.title}</div>
                        <div className="text-sm text-muted">
                          {new Date(event.start_time).toLocaleDateString()}
                          {event.location ? ` • ${event.location}` : ""}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
