import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";
import Footer from "@/components/Footer";
import EventsReviewClient from "./EventsReviewClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getPendingEvents() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const response = await fetch(
      `${baseUrl}/api/admin/events?status=pending_review&limit=50`,
      { cache: "no-store" }
    );
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      console.error("[admin/events] Error fetching pending events:", payload);
      return {
        events: [],
        counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
        error: payload?.error || "Failed to load events",
      };
    }
    return {
      events: payload.data || [],
      counts: payload.counts || { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
    };
  } catch (err) {
    console.error("[admin/events] Error in getPendingEvents:", err);
    return {
      events: [],
      counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
    };
  }
}

export default async function AdminEventsPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserProfile(supabase);

  if (!user) {
    redirect("/login?redirect=/admin/events");
  }

  if (!isAdmin(profile)) {
    redirect("/dashboard");
  }

  const eventsData = await getPendingEvents();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Event Review Queue</h1>
          <EventsReviewClient
            initialEvents={eventsData.events || []}
            initialCounts={
              eventsData.counts || { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 }
            }
            initialStatus="pending_review"
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}
