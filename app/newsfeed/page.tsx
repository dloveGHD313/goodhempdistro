import Footer from "@/components/Footer";
import FeedExperience from "./FeedExperience";
import WelcomeBanner from "./WelcomeBanner";
import RecommendedVendors from "./RecommendedVendors";

export default function NewsFeedPage() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <WelcomeBanner />
        <RecommendedVendors />
        <FeedExperience variant="feed" />
      </main>
      <Footer />
    </div>
  );
}
