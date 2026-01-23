import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClientOrThrow } from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";
import Footer from "@/components/Footer";
import EventsReviewClient from "./EventsReviewClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getPendingEvents() {
  try {
    const admin = getSupabaseAdminClientOrThrow();

    const { data: events, error } = await admin
      .from("events")
      .select(
        "id, title, description, location, start_time, end_time, status, submitted_at, vendor_id, owner_user_id"
      )
      .eq("status", "pending_review")
      .order("submitted_at", { ascending: true });

    if (error) {
      console.error("[admin/events] Error fetching pending events:", error);
      return {
        events: [],
        counts: { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 },
        error: error.message,
      };
    }

    const vendorIds = Array.from(
      new Set((events || []).map((e: any) => e.vendor_id).filter(Boolean))
    );
    const ownerIds = Array.from(
      new Set((events || []).map((e: any) => e.owner_user_id).filter(Boolean))
    );

    const { data: vendors } = vendorIds.length
      ? await admin
          .from("vendors")
          .select("id, business_name, owner_user_id")
          .in("id", vendorIds)
      : { data: [] };

    const { data: profiles } = ownerIds.length
      ? await admin
          .from("profiles")
          .select("id, email")
          .in("id", ownerIds)
      : { data: [] };

    const vendorMap = new Map((vendors || []).map((v: any) => [v.id, v]));
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const normalizedEvents = (events || []).map((e: any) => ({
      ...e,
      vendor_name: vendorMap.get(e.vendor_id)?.business_name || null,
      vendor_email: profileMap.get(e.owner_user_id)?.email || null,
    }));

    const { count: totalCount } = await admin
      .from("events")
      .select("*", { count: "exact", head: true });

    const { count: approvedCount } = await admin
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved");

    const { count: draftCount } = await admin
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("status", "draft");

    const { count: rejectedCount } = await admin
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("status", "rejected");

    return {
      events: normalizedEvents,
      counts: {
        total: totalCount || 0,
        pending: normalizedEvents.length,
        approved: approvedCount || 0,
        draft: draftCount || 0,
        rejected: rejectedCount || 0,
      },
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
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}
