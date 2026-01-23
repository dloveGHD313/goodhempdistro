import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import EventsList from "./EventsList";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Events | Good Hemp Distro",
  description: "Discover upcoming hemp industry events",
};

export const dynamic = 'force-dynamic';

type Event = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  capacity: number | null;
  tickets_sold: number;
  vendor_id?: string | null;
};

async function getPublishedEvents(
  vendorId?: string | null
): Promise<{ events: Event[]; vendorName?: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    let vendorName: string | null = null;
    if (vendorId) {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, business_name")
        .eq("id", vendorId)
        .eq("is_active", true)
        .eq("is_approved", true)
        .maybeSingle();

      if (!vendor) {
        return { events: [], vendorName: null };
      }
      vendorName = vendor.business_name;
    }

    const baseQuery = supabase
      .from("events")
      .select("id, title, description, location, start_time, end_time, capacity, tickets_sold, vendor_id")
      .in("status", ["approved", "published"])
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true });

    const { data, error } = vendorId
      ? await baseQuery.eq("vendor_id", vendorId)
      : await baseQuery;

    if (error) {
      console.error("Error fetching events:", error);
      return { events: [], vendorName };
    }

    return { events: (data || []) as Event[], vendorName };
  } catch (err) {
    console.error("Fatal error fetching events:", err);
    return { events: [], vendorName: null };
  }
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams?: { vendor?: string };
}) {
  const vendorId = searchParams?.vendor || null;
  const { events, vendorName } = await getPublishedEvents(vendorId);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-6 text-accent">
            {vendorName ? `Events from ${vendorName}` : "Upcoming Events"}
          </h1>
          <p className="text-muted mb-12">
            {vendorName
              ? "Explore approved events hosted by this vendor."
              : "Join us for exciting hemp industry events and networking opportunities."}
          </p>

          <EventsList initialEvents={events} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
