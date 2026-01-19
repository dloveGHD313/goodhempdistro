import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getCurrentUserProfile, isVendor } from "@/lib/authz";
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
  try {
    const supabase = await createSupabaseServerClient();
    const { user, profile } = await getCurrentUserProfile(supabase);

    if (!user) {
      redirect("/login?redirect=/vendors/events");
    }

    const { isVendor: userIsVendor, vendor } = await isVendor(supabase, user.id);

    if (!userIsVendor || !vendor) {
      return (
        <div className="min-h-screen text-white flex flex-col">
          <main className="flex-1">
            <section className="section-shell">
              <div className="max-w-2xl mx-auto card-glass p-8 text-center">
                <h1 className="text-2xl font-bold mb-4 text-accent">Vendor Account Required</h1>
                <p className="text-muted mb-6">
                  You need a vendor account to manage events. Please register as a vendor first.
                </p>
                <Link href="/vendor-registration" className="btn-primary">
                  Register as Vendor
                </Link>
              </div>
            </section>
          </main>
          <Footer />
        </div>
      );
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
  } catch (error) {
    console.error("[vendors/events] Error:", error);
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="max-w-2xl mx-auto card-glass p-8 text-center">
              <h1 className="text-2xl font-bold mb-4 text-red-400">Error Loading Page</h1>
              <p className="text-muted mb-6">
                An error occurred while loading this page. Please try again later.
              </p>
              <Link href="/vendors/dashboard" className="btn-secondary">
                Go to Dashboard
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }
}
