import Footer from "@/components/Footer";
import FeedExperience from "./newsfeed/FeedExperience";

export default async function Home() {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="w-full flex-1">
        <FeedExperience variant="landing" />
      </main>
      <Footer />
    </div>
  );
}
