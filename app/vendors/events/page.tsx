import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import EventsClient from "./EventsClient";
import Link from "next/link";

export const dynamic = 'force-dynamic';

async function getVendorEvents() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  // Get vendor
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();

  if (!vendor) {
    return [];
  }

  // Get events with ticket types
  const { data: events } = await supabase
    .from("events")
    .select("id, title, start_time, status, capacity, tickets_sold, created_at")
    .eq("vendor_id", vendor.id)
    .order("created_at", { ascending: false });

  return events || [];
}

export default async function VendorEventsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/vendors/events");
  }

  // Verify vendor
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("owner_user_id", user.id)
    .single();

  if (!vendor) {
    redirect("/vendor-registration");
  }

  const events = await getVendorEvents();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-accent">My Events</h1>
            <Link href="/vendors/events/new" className="btn-primary">
              Create Event
            </Link>
          </div>
          <EventsClient initialEvents={events} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
