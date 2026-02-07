import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";
import Footer from "@/components/Footer";
import FeedExperience from "./newsfeed/FeedExperience";
import { requirePhase15Complete } from "@/lib/server/phase15Gate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// TODO: Later phases will personalize feed ranking based on welcome intents (getWelcomeIntents).
export default async function Home() {
  noStore();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/welcome");
  }

  const phase15Redirect = await requirePhase15Complete(user.id);
  if (phase15Redirect) redirect(phase15Redirect);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="w-full flex-1">
        <FeedExperience variant="landing" />
      </main>
      <Footer />
    </div>
  );
}
