import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import ResetPasswordRedirect from "@/components/ResetPasswordRedirect";

export const dynamic = "force-dynamic";

async function getFeaturedServices() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("services")
      .select("id, name, title, description, pricing_type, price_cents, slug, categories(name)")
      .eq("status", "approved")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) {
      console.error("[homepage] Error fetching services:", error);
      return [];
    }

    return (data || []).map((s: any) => ({
      ...s,
      categories: Array.isArray(s.categories) ? s.categories[0] : s.categories,
    }));
  } catch (err) {
    console.error("[homepage] Fatal error fetching services:", err);
    return [];
  }
}

export default async function HomeMarketingPage() {
  const featuredServices = await getFeaturedServices();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="w-full flex-1">
        <section className="hero-glow">
          <div className="section-shell text-center hero-content">
            <div className="max-w-3xl mx-auto">
              <p className="text-sm uppercase tracking-[0.3em] text-muted mb-4">Good Hemp Distros</p>
              <h1 className="hero-title font-black mb-5 text-accent">
                Premium Hemp Marketplace
              </h1>
              <p className="hero-subtitle mb-10">
                High-quality hemp products from verified vendors. Join the community and explore curated drops.
              </p>
              <div className="flex flex-col md:flex-row gap-4 justify-center">
                <Link href="/get-started" className="btn-primary text-base md:text-lg py-4 px-8">
                  🚀 Get Started Now
                </Link>
                <Link href="/newsfeed" className="btn-secondary text-base md:text-lg py-4 px-8">
                  📰 Browse Feed
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="section-shell section-shell--tight">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: "🔒", title: "Secure Checkout", desc: "Encrypted payments with Stripe" },
              { icon: "📦", title: "Fast Shipping", desc: "Discreet delivery to all 50 states" },
              { icon: "✅", title: "Lab Verified", desc: "All products tested & certified" },
            ].map((feature, i) => (
              <div key={i} className="card-glass card-glass--raised p-6">
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="font-bold text-lg mb-2 text-accent">{feature.title}</h3>
                <p className="text-muted text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section-shell section-shell--tight">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-accent mb-3">
              Explore the Community
            </h2>
            <p className="text-muted">Stay plugged into the latest drops, groups, and conversations.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { emoji: "🏠", label: "News Feed", href: "/newsfeed", desc: "Latest updates from the community" },
              { emoji: "🛍️", label: "Shop Products", href: "/products", desc: "Browse premium hemp products" },
              { emoji: "👥", label: "Groups", href: "/groups", desc: "Join community groups" },
              { emoji: "💬", label: "Forums", href: "/forums", desc: "Discuss & connect" },
            ].map((link, i) => (
              <Link key={i} href={link.href} className="card-glass p-5 hover-lift">
                <div className="text-2xl mb-2">{link.emoji}</div>
                <h3 className="font-bold text-lg mb-1">{link.label}</h3>
                <p className="text-muted text-sm">{link.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {featuredServices.length > 0 && (
          <section className="section-shell section-shell--tight">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-accent mb-3">
                Browse Services
              </h2>
              <p className="text-muted">Find professional services for your hemp business needs.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {featuredServices.map((service: any) => {
                const formatPrice = (pricingType?: string, priceCents?: number) => {
                  if (!pricingType || pricingType === "quote_only") {
                    return "Quote Only";
                  }
                  if (!priceCents) {
                    return "Price TBD";
                  }
                  return `$${((priceCents || 0) / 100).toFixed(2)} ${
                    pricingType === "hourly" ? "/hr" : pricingType === "per_project" ? "/project" : ""
                  }`;
                };

                return (
                  <Link
                    key={service.id}
                    href={`/services/${service.slug || service.id}`}
                    className="card-glass p-6 hover:border-accent transition-colors"
                  >
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
                );
              })}
            </div>
            <div className="text-center">
              <Link href="/services" className="btn-primary inline-block">
                View All Services
              </Link>
            </div>
          </section>
        )}

        <section className="section-shell section-shell--tight text-center">
          <div className="card-glass card-glass--raised p-10">
            <h3 className="text-2xl md:text-3xl font-bold text-accent mb-4">Ready to Join?</h3>
            <p className="text-muted mb-8 text-lg">
              Start exploring premium hemp products and connect with our community.
            </p>
            <Link href="/get-started" className="btn-primary text-base md:text-lg py-3 px-8 inline-block">
              🚀 Get Started
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] mt-8 py-8 px-4 text-center text-muted">
        <p>&copy; 2026 Good Hemp Distro. All rights reserved.</p>
      </footer>
      <ResetPasswordRedirect />
    </div>
  );
}
