import { Suspense } from "react";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase";
import { brand } from "@/lib/brand";
import HeroSection from "./components/HeroSection";
import DualAudienceSection from "./components/DualAudienceSection";
import FeaturedProductsSection from "./components/FeaturedProductsSection";
import HowItWorksSection from "./components/HowItWorksSection";
import LearningWithJaxSection from "./components/LearningWithJaxSection";
import ServicesTeaserSection from "./components/ServicesTeaserSection";
import TrustBarSection from "./components/TrustBarSection";
import MarketingFooter from "./components/MarketingFooter";

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
  const [initialProducts, isAuthenticated] = await Promise.all([
    getFeaturedProducts(),
    getIsAuthenticated(),
  ]);

  return (
    <main className="min-h-screen bg-[#0D1512] text-[#F0EDE6] font-sans">
      <HeroSection isAuthenticated={isAuthenticated} />
      <DualAudienceSection isAuthenticated={isAuthenticated} />
      <Suspense fallback={<div className="h-64" />}>
        <FeaturedProductsSection initialProducts={initialProducts} />
      </Suspense>
      <HowItWorksSection />
      <LearningWithJaxSection />
      <ServicesTeaserSection />
      <TrustBarSection />
      <MarketingFooter />
    </main>
  );
}
