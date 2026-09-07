import { Suspense } from "react";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase";
import { brand } from "@/lib/brand";
import HeroSection from "./components/HeroSection";
import DualAudienceSection from "./components/DualAudienceSection";
import FeaturedProductsSection from "./components/FeaturedProductsSection";
import HowItWorksSection from "./components/HowItWorksSection";
import LearningWithJaxSection, { type WelcomeEpisode } from "./components/LearningWithJaxSection";
import { getEpisodesForViewer } from "@/lib/jax/episodes";
import ServicesTeaserSection from "./components/ServicesTeaserSection";
import TrustBarSection from "./components/TrustBarSection";
import LiveStatsSection from "./components/LiveStatsSection";
import { getPlatformStats, type PlatformStats } from "@/lib/server/platformStats";
import MarketingFooter from "./components/MarketingFooter";
import BootSequence from "./components/BootSequence";

export const metadata: Metadata = {
  title: "Good Hemp Distro — The Hemp Industry Platform",
  description:
    "Discover verified hemp vendors, shop COA-certified products, and grow your hemp business. Every vendor. Every product. One platform.",
  openGraph: {
    title: "Good Hemp Distro — The Hemp Industry Platform",
    description:
      "Discover verified hemp vendors, shop COA-certified products, and grow your hemp business. Every vendor. Every product. One platform.",
    url: `${brand.url}/welcome`,
    siteName: brand.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Good Hemp Distro — The Hemp Industry Platform",
    description:
      "Discover verified hemp vendors, shop COA-certified products, and grow your hemp business. Every vendor. Every product. One platform.",
  },
};

type FeaturedProduct = {
  id: string;
  name: string;
  market_category: string | null;
  price_cents: number;
  vendor_id: string | null;
  vendor_name: string | null;
  image_url: string | null;
};

async function getFeaturedProducts(): Promise<FeaturedProduct[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: rawProducts, error } = await supabase
      .from("products")
      .select("id, name, market_category, price_cents, vendor_id, image_url")
      .eq("status", "approved")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(6);

    if (error || !rawProducts?.length) {
      return [];
    }

    const vendorIds = Array.from(
      new Set(rawProducts.map((item) => item.vendor_id).filter((id): id is string => Boolean(id)))
    );

    const vendorMap = new Map<string, string>();
    if (vendorIds.length > 0) {
      const { data: vendorRows } = await supabase
        .from("vendors")
        .select("id, business_name")
        .in("id", vendorIds);

      (vendorRows || []).forEach((vendor) => {
        vendorMap.set(vendor.id, vendor.business_name || "Verified Vendor");
      });
    }

    return rawProducts.map((item) => ({
      ...item,
      vendor_name: item.vendor_id ? vendorMap.get(item.vendor_id) || "Verified Vendor" : "Verified Vendor",
    }));
  } catch {
    return [];
  }
}

/** Real Learning with JAX episodes for the logged-out welcome page (fail-soft). */
async function getWelcomeEpisodes(): Promise<WelcomeEpisode[]> {
  try {
    const { episodes } = await getEpisodesForViewer(null);
    return episodes.slice(0, 3).map((ep) => {
      const mins = ep.duration_seconds ? Math.max(1, Math.round(ep.duration_seconds / 60)) : null;
      const pillar = ep.pillar === "webisodes" ? "Webisode" : "Episode";
      return {
        id: ep.id,
        title: ep.title,
        meta: mins ? `${pillar} • ${mins} min` : `${pillar} • Watch now`,
      };
    });
  } catch {
    return [];
  }
}

/** Live counts for the stats strip (fail-soft: null hides the numbers). */
async function getStats(): Promise<PlatformStats | null> {
  try {
    return await getPlatformStats();
  } catch {
    return null;
  }
}

async function getIsAuthenticated(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return !!user;
  } catch {
    return false;
  }
}

export default async function WelcomePage() {
  const [initialProducts, isAuthenticated, welcomeEpisodes, stats] = await Promise.all([
    getFeaturedProducts(),
    getIsAuthenticated(),
    getWelcomeEpisodes(),
    getStats(),
  ]);

  return (
    <main className="min-h-screen bg-[#0D1512] text-[#F0EDE6] font-sans">
      {/* Phase 0 boot sequence: first visit only, never for signed-in users. */}
      <Suspense fallback={null}>
        <BootSequence stats={stats} isAuthenticated={isAuthenticated} />
      </Suspense>
      <HeroSection isAuthenticated={isAuthenticated} />
      <LiveStatsSection stats={stats} />
      <DualAudienceSection isAuthenticated={isAuthenticated} />
      <Suspense fallback={<div className="h-64" />}>
        <FeaturedProductsSection initialProducts={initialProducts} />
      </Suspense>
      <HowItWorksSection />
      <LearningWithJaxSection episodes={welcomeEpisodes} />
      <ServicesTeaserSection />
      <TrustBarSection />
      <MarketingFooter />
    </main>
  );
}
