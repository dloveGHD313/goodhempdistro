import Link from "next/link";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getUserVerificationStatus } from "@/lib/server/idVerification";
import Footer from "@/components/Footer";
import FavoriteButton from "@/components/engagement/FavoriteButton";
import ReviewSection from "@/components/engagement/ReviewSection";

type Vendor = {
  id: string;
  business_name: string;
  description?: string | null;
  categories?: string[] | null;
  tags?: string[] | null;
  state?: string | null;
  city?: string | null;
  vendor_type?: string | null;
  website?: string | null;
  created_at?: string;
};

type Props = {
  params: Promise<{ id: string }>;
};

// Force dynamic rendering since this page requires authentication
export const dynamic = 'force-dynamic';

async function getVendor(id: string): Promise<Vendor | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("vendors")
      .select("id, business_name, description, categories, tags, state, city, vendor_type, website, created_at")
      .eq("id", id)
      .eq("is_active", true)
      .eq("is_approved", true)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (err) {
    console.error("Error fetching vendor:", err);
    return null;
  }
}

type ListingProduct = {
  id: string;
  name: string;
  price_cents: number;
  category_id: string | null;
};

type ListingService = {
  id: string;
  title: string;
  description?: string | null;
  pricing_type?: string | null;
};

type ListingEvent = {
  id: string;
  title: string;
  start_time: string;
  location?: string | null;
};

async function getVendorListings(vendorId: string, includeGated: boolean) {
  const supabase = await createSupabaseServerClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, name, price_cents, category_id, is_gated")
    .eq("vendor_id", vendorId)
    .eq("status", "approved")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(6);
  const filteredProducts = (products || []).filter((product) =>
    includeGated ? true : product.is_gated !== true
  );

  const { data: services } = await supabase
    .from("services")
    .select("id, title, description, pricing_type")
    .eq("vendor_id", vendorId)
    .eq("status", "approved")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(6);

  const { data: events } = await supabase
    .from("events")
    .select("id, title, start_time, location")
    .eq("vendor_id", vendorId)
    .in("status", ["approved", "published"])
    .order("start_time", { ascending: true })
    .limit(6);

  return {
    products: (filteredProducts || []) as ListingProduct[],
    services: (services || []) as ListingService[],
    events: (events || []) as ListingEvent[],
  };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const vendor = await getVendor(params.id);

  if (!vendor) {
    return {
      title: "Vendor Not Found | Good Hemp Distro",
    };
  }

  return {
    title: `${vendor.business_name} | Good Hemp Distro`,
    description: vendor.description || `Learn more about ${vendor.business_name}`,
  };
}

export default async function VendorDetailPage(props: Props) {
  const params = await props.params;
  const vendor = await getVendor(params.id);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const verification = await getUserVerificationStatus(user?.id ?? null);
  const includeGated = verification.status === "approved";

  if (!vendor) {
    notFound();
  }

  const listings = await getVendorListings(vendor.id, includeGated);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <Link href="/vendors" className="text-accent hover:underline mb-8 inline-block">
            ← Back to Vendors
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="space-y-6">
              <div className="surface-card p-8 text-center">
                <div className="text-sm text-[var(--brand-lime)] border border-[var(--brand-lime)]/40 bg-[var(--brand-lime)]/15 px-3 py-1 rounded-full inline-flex mb-4">
                  Verified & Approved
                </div>
                <div className="flex justify-center mb-4">
                  <FavoriteButton entityType="vendor" entityId={vendor.id} size="md" />
                </div>
                <div className="text-7xl mb-4">🌿</div>
                <h1 className="text-3xl font-bold mb-2">{vendor.business_name}</h1>
                <p className="text-muted mb-4">
                  {vendor.vendor_type ? vendor.vendor_type.replace(/_/g, " ") : "Hemp vendor"}
                </p>
                <p className="text-muted text-sm mb-4">
                  {[vendor.city, vendor.state].filter(Boolean).join(", ") || "Location available on profile"}
                </p>
                {vendor.website && (
                  <a
                    href={vendor.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary w-full inline-flex justify-center"
                  >
                    Visit Website
                  </a>
                )}
              </div>

              {(vendor.categories?.length || vendor.tags?.length) && (
                <div className="surface-card p-6">
                  <h2 className="text-xl font-semibold mb-4">Specialties</h2>
                  <div className="flex gap-2 flex-wrap">
                    {[...(vendor.categories || []), ...(vendor.tags || [])].map((tag) => (
                      <span
                        key={tag}
                        className="bg-[var(--brand-lime)]/15 text-[var(--brand-lime)] px-3 py-1 rounded text-sm border border-[var(--brand-lime)]/40"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-2 space-y-8">
              <div className="surface-card p-8">
                <h2 className="text-2xl font-bold mb-4">About</h2>
                <p className="text-muted leading-relaxed">
                  {vendor.description ||
                    "This vendor specializes in premium hemp products with a commitment to quality and sustainability."}
                </p>
              </div>

              <ReviewSection entityType="vendor" entityId={vendor.id} title="Vendor Reviews" />

              <div className="surface-card p-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Approved Products</h2>
                  <Link href={`/products?vendor=${vendor.id}`} className="text-accent hover:underline text-sm">
                    View all products
                  </Link>
                </div>
                {listings.products.length === 0 ? (
                  <p className="text-muted">No approved products yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {listings.products.map((product) => (
                      <Link key={product.id} href={`/products/${product.id}`} className="card-glass p-4 hover-lift">
                        <div className="font-semibold mb-2">{product.name}</div>
                        <div className="text-sm text-muted">
                          ${((product.price_cents || 0) / 100).toFixed(2)}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="surface-card p-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Approved Services</h2>
                  <Link href={`/services?vendor=${vendor.id}`} className="text-accent hover:underline text-sm">
                    View all services
                  </Link>
                </div>
                {listings.services.length === 0 ? (
                  <p className="text-muted">No approved services yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {listings.services.map((service) => (
                      <Link key={service.id} href={`/services/${service.id}`} className="card-glass p-4 hover-lift">
                        <div className="font-semibold mb-2">{service.title}</div>
                        {service.description && (
                          <p className="text-sm text-muted line-clamp-2">{service.description}</p>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="surface-card p-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">Events</h2>
                  <Link href={`/events?vendor=${vendor.id}`} className="text-accent hover:underline text-sm">
                    View all events
                  </Link>
                </div>
                {listings.events.length === 0 ? (
                  <p className="text-muted">No upcoming events yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {listings.events.map((event) => (
                      <Link key={event.id} href={`/events/${event.id}`} className="card-glass p-4 hover-lift">
                        <div className="font-semibold mb-2">{event.title}</div>
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
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
