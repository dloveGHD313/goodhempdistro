import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import { HeroShell } from "@/components/ui/HeroShell";
import EventsList from "./EventsList";
import { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Hemp Industry Events | Good Hemp Distro",
  description:
    "Find hemp industry events, pop-ups, and vendor showcases near you. Connect with the hemp community.",
  openGraph: {
    title: "Hemp Industry Events | Good Hemp Distro",
    description:
      "Find hemp industry events, pop-ups, and vendor showcases near you. Connect with the hemp community.",
    url: `${brand.url}/events`,
    siteName: brand.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hemp Industry Events | Good Hemp Distro",
    description:
      "Find hemp industry events, pop-ups, and vendor showcases near you. Connect with the hemp community.",
  },
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
        <section className="welcome-hero py-10 px-4 futuristic-glow">
          <HeroShell cinematic glassPanel={false} contentClassName="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.35em] text-muted mb-2">Community</p>
            <h1 className="hero-title text-accent mb-2">Events</h1>
            <p className="hero-subtitle">
              Discover hemp industry events, meetups, and vendor booths. Browse upcoming events or host your own.
            </p>
          </HeroShell>
        </section>

        <section className="section-shell">
          <h2 className="text-2xl font-bold mb-6 text-accent">
            {vendorName ? `Events from ${vendorName}` : "Upcoming Events"}
          </h2>
          <p className="text-muted mb-8">
            {vendorName
              ? "Explore approved events hosted by this vendor."
              : "Join us for exciting hemp industry events and networking opportunities."}
          </p>

          <EventsList initialEvents={events} />

          <div className="surface-glass rounded-[var(--radius-xl)] p-6 sm:p-8 mt-12 max-w-2xl">
            <h3 className="text-lg font-semibold text-foreground mb-2">Hosting an event or selling booths?</h3>
            <p className="text-muted text-sm mb-4">
              Apply to become a vendor to create events and sell tickets or vendor booth slots.
            </p>
            <Link href="/vendor-registration" className="btn-primary inline-block">
              Go to vendor registration
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
