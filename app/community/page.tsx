import type { Metadata } from "next";
import Footer from "@/components/Footer";
import FeedExperience from "../newsfeed/FeedExperience";
import RecommendedVendors from "../newsfeed/RecommendedVendors";

export const metadata: Metadata = {
  title: "Community Feed | Good Hemp Distro",
  description:
    "The Good Hemp Distro community feed — vendors, growers, builders, and consumers sharing what they're working on. Compliance-aware, vendor-friendly, no algorithm games.",
};

// Build #7: /community is the real community feed (was a ComingSoonPage stub
// from PR #175). It reuses the newsfeed experience under the Community brand.
export default function CommunityPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell text-center pt-10 pb-2">
          <h1 className="text-3xl md:text-4xl font-bold text-accent mb-3">The Community Feed</h1>
          <p className="text-muted max-w-2xl mx-auto">
            Vendors, growers, builders, and consumers sharing what they&apos;re working on.
            Compliance-aware, vendor-friendly, no algorithm games.
          </p>
        </section>
        <RecommendedVendors />
        <FeedExperience variant="feed" />
      </main>
      <Footer />
    </div>
  );
}
