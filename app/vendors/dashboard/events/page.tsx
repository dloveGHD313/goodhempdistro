import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import EventsClient from "@/app/vendors/events/EventsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EventCounts = {
  draft: number;
  pending_review: number;
  approved: number;
  rejected: number;
  published: number;
  cancelled: number;
  total: number;
};

async function getVendorEvents(userId: string) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: vendor } = await supabase
      .from("vendors")
      .select("id, owner_user_id, vendor_onboarding_completed, terms_accepted_at, compliance_acknowledged_at")
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (!vendor) {
      return null;
    }

    if (
      !vendor.vendor_onboarding_completed ||
      !vendor.terms_accepted_at ||
      !vendor.compliance_acknowledged_at
    ) {
      redirect("/onboarding/vendor");
    }

    const { data: events, error } = await supabase
      .from("events")
      .select("id, title, start_time, status, capacity, tickets_sold, created_at, submitted_at, reviewed_at, rejection_reason")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[vendors/dashboard/events] Error fetching events:", error);
      return {
        events: [],
        counts: { draft: 0, pending_review: 0, approved: 0, rejected: 0, published: 0, cancelled: 0, total: 0 },
      };
    }

    const counts: EventCounts = {
      draft: 0,
      pending_review: 0,
      approved: 0,
      rejected: 0,
      published: 0,
      cancelled: 0,
      total: (events || []).length,
    };

    (events || []).forEach((event) => {
      if (event.status === "draft") counts.draft += 1;
      if (event.status === "pending_review") counts.pending_review += 1;
      if (event.status === "approved") counts.approved += 1;
      if (event.status === "rejected") counts.rejected += 1;
      if (event.status === "published") counts.published += 1;
      if (event.status === "cancelled") counts.cancelled += 1;
    });

    return {
      events: events || [],
      counts,
    };
  } catch (err) {
    console.error("[vendors/dashboard/events] Error in getVendorEvents:", err);
    return {
      events: [],
      counts: { draft: 0, pending_review: 0, approved: 0, rejected: 0, published: 0, cancelled: 0, total: 0 },
    };
  }
}

export default async function VendorDashboardEventsPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/vendors/dashboard/events");
  }

  const eventsData = await getVendorEvents(user.id);

  if (!eventsData) {
    redirect("/vendor-registration");
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <h1 className="text-4xl font-bold text-accent">Event Listings</h1>
            <Link href="/vendors/events/new" className="btn-primary">
              Create Event
            </Link>
          </div>

          <div className="card-glass p-6 mb-8">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-muted">
              <div>Drafts: <span className="text-white">{eventsData.counts.draft}</span></div>
              <div>Pending: <span className="text-white">{eventsData.counts.pending_review}</span></div>
              <div>Approved: <span className="text-white">{eventsData.counts.approved}</span></div>
              <div>Published: <span className="text-white">{eventsData.counts.published}</span></div>
              <div>Rejected: <span className="text-white">{eventsData.counts.rejected}</span></div>
              <div>Cancelled: <span className="text-white">{eventsData.counts.cancelled}</span></div>
            </div>
          </div>

          <EventsClient initialEvents={eventsData.events || []} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
