"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type FeedType = "text" | "product" | "event" | "blog";

type FeedItem = {
  id: string;
  type: FeedType;
  title: string;
  excerpt: string;
  author: string;
  postedAt: string;
  vipBadge?: "VIP Vendor" | "VIP Consumer";
  location?: string;
  productPrice?: string;
  vendorName?: string;
  eventDate?: string;
  readTime?: string;
  tags?: string[];
  ctaLabel?: string;
  ctaHref?: string;
};

const feedItems: FeedItem[] = [
  {
    id: "post-1",
    type: "text",
    title: "Morning drop: Community check-in",
    excerpt:
      "What are you prioritizing this week? Share your top product, favorite vendor, or local event.",
    author: "Lina W.",
    postedAt: "8m ago",
    vipBadge: "VIP Consumer",
    tags: ["Community", "Check-in"],
    ctaLabel: "Join the convo",
    ctaHref: "/groups",
  },
  {
    id: "post-2",
    type: "product",
    title: "Midnight Bloom Gummies",
    excerpt:
      "Small-batch, lab-verified gummies with nighttime botanicals. Limited local delivery today.",
    author: "Sunset Labs",
    postedAt: "22m ago",
    vipBadge: "VIP Vendor",
    productPrice: "$28.00",
    vendorName: "Sunset Labs",
    tags: ["COA Verified", "Fast Delivery"],
    ctaLabel: "View product",
    ctaHref: "/products",
  },
  {
    id: "post-3",
    type: "event",
    title: "LA Hemp Social — Rooftop Meetup",
    excerpt:
      "Live DJs, vendor tastings, and compliance Q&A. RSVP spots are filling quickly.",
    author: "Good Hemp Events",
    postedAt: "54m ago",
    eventDate: "Feb 1 · 7:00 PM",
    location: "Los Angeles, CA",
    tags: ["Networking", "Live"],
    ctaLabel: "See event",
    ctaHref: "/events",
  },
  {
    id: "post-4",
    type: "blog",
    title: "Compliance Quick Hits: 2026 Shipping Updates",
    excerpt:
      "A breakdown of packaging and labeling updates that affect multi-state hemp delivery.",
    author: "Compliance Desk",
    postedAt: "1h ago",
    readTime: "4 min read",
    tags: ["Compliance", "News"],
    ctaLabel: "Read brief",
    ctaHref: "/blog",
  },
  {
    id: "post-5",
    type: "product",
    title: "Revive CBD Balm",
    excerpt:
      "High potency topical with terpene-rich botanicals. Ships locally within 2 hours.",
    author: "Driftwood Apothecary",
    postedAt: "2h ago",
    vipBadge: "VIP Vendor",
    productPrice: "$42.00",
    vendorName: "Driftwood Apothecary",
    tags: ["Local Drop", "Verified Vendor"],
    ctaLabel: "Order now",
    ctaHref: "/products",
  },
  {
    id: "post-6",
    type: "text",
    title: "Vendor spotlight: The Green Line",
    excerpt:
      "Celebrating The Green Line for hitting 1k deliveries and 4.9⭐ community rating.",
    author: "Marketplace Team",
    postedAt: "3h ago",
    tags: ["Spotlight", "Vendor"],
    ctaLabel: "Meet vendor",
    ctaHref: "/vendors",
  },
];

const filters = [
  { id: "all", label: "All" },
  { id: "text", label: "Community" },
  { id: "product", label: "Products" },
  { id: "event", label: "Events" },
  { id: "blog", label: "News" },
] as const;

function TypeBadge({ type }: { type: FeedType }) {
  const label =
    type === "text" ? "Community" : type === "product" ? "Product" : type === "event" ? "Event" : "News";
  return <span className="feed-type-badge">{label}</span>;
}

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <article className="feed-card hover-lift">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TypeBadge type={item.type} />
          {item.vipBadge && <span className="vip-badge">{item.vipBadge}</span>}
        </div>
        <span className="text-xs text-muted">{item.postedAt}</span>
      </div>
      <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
      <p className="text-muted mb-4">{item.excerpt}</p>

      {(item.tags?.length || item.productPrice || item.eventDate || item.readTime) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {item.productPrice && <span className="info-pill">{item.productPrice}</span>}
          {item.eventDate && <span className="info-pill">{item.eventDate}</span>}
          {item.readTime && <span className="info-pill">{item.readTime}</span>}
          {item.tags?.map((tag) => (
            <span key={tag} className="tag-pill">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">
          {item.vendorName ? `${item.vendorName} • ` : ""}
          {item.author}
          {item.location ? ` • ${item.location}` : ""}
        </span>
        {item.ctaHref && item.ctaLabel && (
          <Link href={item.ctaHref} className="btn-ghost">
            {item.ctaLabel}
          </Link>
        )}
      </div>
    </article>
  );
}

export default function FeedExperience({ variant = "feed" }: { variant?: "feed" | "landing" }) {
  const [activeFilter, setActiveFilter] = useState<(typeof filters)[number]["id"]>("all");

  const filteredItems = useMemo(() => {
    if (activeFilter === "all") return feedItems;
    return feedItems.filter((item) => item.type === activeFilter);
  }, [activeFilter]);

  return (
    <section className="section-shell section-shell--tight feed-shell">
      <div className="feed-hero card-glass p-6 mb-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-muted mb-2">Good Hemp Social</p>
            <h1 className="text-3xl md:text-4xl font-bold text-accent mb-3">
              {variant === "landing" ? "Live Community Feed" : "Community News Feed"}
            </h1>
            <p className="text-muted max-w-2xl">
              Real-time drops, VIP vendors, and local events — all in one social-first marketplace feed.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/products" className="btn-primary">
              Shop local now
            </Link>
            <Link href="/get-started" className="btn-secondary">
              Join the community
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-8">
        <div className="space-y-6">
          <div className="feed-filter-bar">
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={`filter-chip ${activeFilter === filter.id ? "filter-chip--active" : ""}`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {filteredItems.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}

          {filteredItems.length === 0 && (
            <div className="card-glass p-8 text-center">
              <p className="text-muted">No posts in this channel yet.</p>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <div className="card-glass p-6">
            <h2 className="text-lg font-semibold mb-3">VIP Spotlight</h2>
            <div className="space-y-4">
              {[
                { title: "Sunset Labs", meta: "VIP Vendor · LA", href: "/vendors" },
                { title: "Jade Collins", meta: "VIP Consumer · NYC", href: "/account" },
              ].map((spot) => (
                <Link key={spot.title} href={spot.href} className="vip-spotlight">
                  <div className="text-sm font-semibold">{spot.title}</div>
                  <div className="text-xs text-muted">{spot.meta}</div>
                </Link>
              ))}
            </div>
          </div>

          <div className="card-glass p-6">
            <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
            <div className="grid gap-3">
              <Link href="/events" className="action-card">🎪 Explore events</Link>
              <Link href="/vendors" className="action-card">🏪 Meet vendors</Link>
              <Link href="/products" className="action-card">🛍️ Shop products</Link>
              <Link href="/logistics" className="action-card">🚚 Delivery network</Link>
            </div>
          </div>

          <div className="card-glass p-6">
            <h2 className="text-lg font-semibold mb-3">Compliance Status</h2>
            <p className="text-muted text-sm mb-4">
              Verified vendors and lab-backed products are highlighted across the ecosystem.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">COA Verified</span>
                <span className="info-pill">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Vendor Reviews</span>
                <span className="info-pill">On</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Age Gate</span>
                <span className="info-pill">21+</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
