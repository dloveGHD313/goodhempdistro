import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import Footer from "@/components/Footer";
import EventsClient from "./EventsClient";

export const dynamic = 'force-dynamic';

async function getAdminEvents() {
  const admin = getSupabaseAdminClient();

  const { data: events, error } = await admin
    .from("events")
    .select("id, title, start_time, status, capacity, tickets_sold, created_at, vendors(business_name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching admin events:", error);
    return [];
  }

  return (events || []).map((event: any) => ({
    ...event,
    vendors: Array.isArray(event.vendors) ? event.vendors[0] : event.vendors,
  }));
}

export default async function AdminEventsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/admin/events");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const events = await getAdminEvents();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Events Management</h1>
          <EventsClient initialEvents={events} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
