import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";
import EventsReviewClient from "./EventsReviewClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_STATUSES = ["pending_review", "approved", "rejected", "draft"] as const;

async function getEventsSummary() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/admin/events?summary=1`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      console.error("[admin/events] Error fetching event summary:", payload);
      return {
        counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
        suggestedDefaultStatus: "pending_review",
      };
    }
    return {
      counts: payload.counts || { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
      suggestedDefaultStatus: payload.suggestedDefaultStatus || "pending_review",
    };
  } catch (err) {
    console.error("[admin/events] Error in getEventsSummary:", err);
    return {
      counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
      suggestedDefaultStatus: "pending_review",
    };
  }
}

async function getPendingEvents(status: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const response = await fetch(
      `${baseUrl}/api/admin/events?status=${status}&limit=50`,
      { cache: "no-store" }
    );
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      console.error("[admin/events] Error fetching events:", payload);
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
    console.error("[admin/events] Error in getEventsByStatus:", err);
    return {
      events: [],
      counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
    };
  }
}

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  noStore();

  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/events");
  }

  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  const summary = await getEventsSummary();
  const requestedStatus = searchParams?.status;
  const initialStatus = VALID_STATUSES.includes(requestedStatus as (typeof VALID_STATUSES)[number])
    ? (requestedStatus as (typeof VALID_STATUSES)[number])
    : summary.suggestedDefaultStatus;

  const eventsData = await getPendingEvents(initialStatus);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Event Review Queue</h1>
          <EventsReviewClient
            initialEvents={eventsData.events || []}
            initialCounts={
              eventsData.counts || summary.counts || { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 }
            }
            initialStatus={initialStatus}
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}
