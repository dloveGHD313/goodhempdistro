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
  vendors: {
    business_name: string;
  } | null;
};

async function getPublishedEvents(): Promise<Event[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("events")
      .select("id, title, description, location, start_time, end_time, capacity, tickets_sold, vendors(business_name)")
      .eq("status", "published")
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Error fetching events:", error);
      return [];
    }

    // Normalize vendors relation (may be array or object)
    return (data || []).map((event: any) => ({
      ...event,
      vendors: Array.isArray(event.vendors) ? event.vendors[0] : event.vendors,
    }));
  } catch (err) {
    console.error("Fatal error fetching events:", err);
    return [];
  }
}

export default async function EventsPage() {
  const events = await getPublishedEvents();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-6 text-accent">Upcoming Events</h1>
          <p className="text-muted mb-12">
            Join us for exciting hemp industry events and networking opportunities.
          </p>

          <EventsList initialEvents={events} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
