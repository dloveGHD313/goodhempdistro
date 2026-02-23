"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Reveal, ScrollReveal, Stagger, StaggerChild, HoverLift, HERO_DELAYS } from "@/components/motion";
import { useMotion } from "@/components/motion";
import ResetPasswordRedirect from "@/components/ResetPasswordRedirect";

const FEATURES = [
  { icon: "🔒", title: "Secure Checkout", desc: "Encrypted payments with Stripe" },
  { icon: "📦", title: "Fast Shipping", desc: "Discreet delivery to all 50 states" },
  { icon: "✅", title: "Lab Verified", desc: "All products tested & certified" },
] as const;

const COMMUNITY_LINKS = [
  { emoji: "🏠", label: "News Feed", href: "/newsfeed", desc: "Latest updates from the community" },
  { emoji: "🛍️", label: "Shop Products", href: "/products", desc: "Browse premium hemp products" },
  { emoji: "👥", label: "Groups", href: "/groups", desc: "Join community groups" },
  { emoji: "💬", label: "Forums", href: "/forums", desc: "Discuss & connect" },
] as const;

const hoverTransition = { duration: 0.18 };

type Service = {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  pricing_type?: string;
  price_cents?: number;
  slug?: string;
  categories?: { name?: string } | null;
};

export default function HomeMotion({ featuredServices }: { featuredServices: Service[] }) {
  const { reducedMotion } = useMotion();

  const formatPrice = (pricingType?: string, priceCents?: number) => {
    if (!pricingType || pricingType === "quote_only") return "Quote Only";
    if (!priceCents) return "Price TBD";
    return `$${(priceCents / 100).toFixed(2)} ${pricingType === "hourly" ? "/hr" : pricingType === "per_project" ? "/project" : ""}`;
  };

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="w-full flex-1">
        <section className="hero-glow">
          <div className="section-shell text-center hero-content">
            <div className="max-w-3xl mx-auto">
              <Reveal delay={HERO_DELAYS.title}>
                <p className="text-sm uppercase tracking-[0.3em] text-muted mb-4">Good Hemp Distros</p>
                <h1 className="hero-title mb-5 text-accent">Premium Hemp Marketplace</h1>
              </Reveal>
              <Reveal delay={HERO_DELAYS.subtitle}>
                <p className="hero-subtitle mb-10">
                  High-quality hemp products from verified vendors. Join the community and explore curated drops.
                </p>
              </Reveal>
              <Reveal delay={HERO_DELAYS.ctaRow} className="flex flex-col md:flex-row gap-4 justify-center">
                <HoverLift as="span">
                  <Link href="/get-started" className="btn-primary text-base md:text-lg py-4 px-8 inline-block">
                    🚀 Get Started Now
                  </Link>
                </HoverLift>
                <HoverLift as="span">
                  <Link href="/newsfeed" className="btn-secondary text-base md:text-lg py-4 px-8 inline-block">
                    📰 Browse Feed
                  </Link>
                </HoverLift>
              </Reveal>
            </div>
          </div>
        </section>

        <ScrollReveal once amount={0.2}>
          <section className="section-shell section-shell--tight">
            <Stagger staggerChildren={0.08} delayChildren={0.1} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {FEATURES.map((f, i) => (
                <StaggerChild key={i}>
                  <motion.div
                    className="card-glass card-glass--raised p-6"
                    whileHover={reducedMotion ? undefined : { scale: 1.02, y: -2 }}
                    transition={hoverTransition}
                  >
                    <div className="text-4xl mb-3">{f.icon}</div>
                    <h3 className="font-bold text-lg mb-2 text-accent">{f.title}</h3>
                    <p className="text-muted text-sm">{f.desc}</p>
                  </motion.div>
                </StaggerChild>
              ))}
            </Stagger>
          </section>
        </ScrollReveal>

        <ScrollReveal once amount={0.2}>
          <section className="section-shell section-shell--tight">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-accent mb-3">Explore the Community</h2>
              <p className="text-muted">Stay plugged into the latest drops, groups, and conversations.</p>
            </div>
            <Stagger staggerChildren={0.06} delayChildren={0.05} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {COMMUNITY_LINKS.map((link, i) => (
                <StaggerChild key={i}>
                  <motion.div
                    whileHover={reducedMotion ? undefined : { scale: 1.02, y: -2 }}
                    transition={hoverTransition}
                  >
                    <Link href={link.href} className="card-glass p-5 block hover:border-accent transition-colors">
                      <div className="text-2xl mb-2">{link.emoji}</div>
                      <h3 className="font-bold text-lg mb-1">{link.label}</h3>
                      <p className="text-muted text-sm">{link.desc}</p>
                    </Link>
                  </motion.div>
                </StaggerChild>
              ))}
            </Stagger>
          </section>
        </ScrollReveal>

        {featuredServices.length > 0 && (
          <ScrollReveal once amount={0.2}>
            <section className="section-shell section-shell--tight">
              <div className="text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-bold text-accent mb-3">Browse Services</h2>
                <p className="text-muted">Find professional services for your hemp business needs.</p>
              </div>
              <Stagger staggerChildren={0.06} delayChildren={0.05} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {featuredServices.map((service) => (
                  <StaggerChild key={service.id}>
                    <motion.div
                      whileHover={reducedMotion ? undefined : { scale: 1.02, y: -2 }}
                      transition={hoverTransition}
                    >
                      <Link
                        href={`/services/${service.slug || service.id}`}
                        className="card-glass p-6 block hover:border-accent transition-colors"
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
                    </motion.div>
                  </StaggerChild>
                ))}
              </Stagger>
              <div className="text-center">
                <HoverLift as="span">
                  <Link href="/services" className="btn-primary inline-block">View All Services</Link>
                </HoverLift>
              </div>
            </section>
          </ScrollReveal>
        )}

        <ScrollReveal once amount={0.2}>
          <section className="section-shell section-shell--tight text-center">
            <motion.div
              className="card-glass card-glass--raised p-10"
              whileHover={reducedMotion ? undefined : { y: -2 }}
              transition={hoverTransition}
            >
              <h3 className="text-2xl md:text-3xl font-bold text-accent mb-4">Ready to Join?</h3>
              <p className="text-muted mb-8 text-lg">
                Start exploring premium hemp products and connect with our community.
              </p>
              <HoverLift as="span">
                <Link href="/get-started" className="btn-primary text-base md:text-lg py-3 px-8 inline-block">
                  🚀 Get Started
                </Link>
              </HoverLift>
            </motion.div>
          </section>
        </ScrollReveal>
      </main>

      <footer className="border-t border-[var(--border)] mt-8 py-8 px-4 text-center text-muted">
        <p>&copy; 2026 Good Hemp Distro. All rights reserved.</p>
      </footer>
      <ResetPasswordRedirect />
    </div>
  );
}
