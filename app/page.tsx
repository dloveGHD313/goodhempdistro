import Hero from "@/components/marketing/Hero";
import TrustBadges from "@/components/marketing/TrustBadges";
import Categories from "@/components/marketing/Categories";
import Community from "@/components/marketing/Community";
import Footer from "@/components/marketing/Footer";

export default function Home() {
  return (
    <main className="min-h-screen text-white">
      <Hero />
      <TrustBadges />
      <Categories />
      <Community />
      <Footer />
    </main>
  );
}
