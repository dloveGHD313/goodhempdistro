import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export default async function VendorEventsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/vendors/events");

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!vendor) redirect("/");

  const { data: events } = await supabase
    .from("events")
    .select("id, title, start_time, ticket_price_cents, tickets_sold")
    .eq("vendor_id", vendor.id)
    .order("start_time", { ascending: false });

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1 section-shell">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-accent">My Events</h1>
          <Link href="/vendors/events/create" className="btn-primary">Create Event</Link>
        </div>
        <div className="space-y-4">
          {(events || []).map((event: any) => (
            <article key={event.id} className="card-glass p-6">
              <h2 className="text-xl font-semibold">{event.title}</h2>
              <p className="text-muted">{new Date(event.start_time).toLocaleString()}</p>
              <p className="text-green-400">Ticket Price: {typeof event.ticket_price_cents === "number" ? `$${(event.ticket_price_cents/100).toFixed(2)}` : "N/A"}</p>
              <p className="text-muted">Tickets sold: {event.tickets_sold ?? 0}</p>
              <Link href={`/vendors/events/${event.id}/edit`} className="btn-secondary inline-block mt-3">Edit</Link>
            </article>
          ))}
          {(!events || events.length===0) && <div className="card-glass p-6 text-muted">No events created yet.</div>}
        </div>
      </main>
      <Footer />
    </div>
  );
}
