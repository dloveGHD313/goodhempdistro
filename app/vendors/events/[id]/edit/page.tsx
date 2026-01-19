import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getCurrentUserProfile, isVendor } from "@/lib/authz";
import Footer from "@/components/Footer";
import EditEventForm from "./EditEventForm";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
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
                  You need a vendor account to edit events. Please register as a vendor first.
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

    if (vendor.status !== "active") {
      return (
        <div className="min-h-screen text-white flex flex-col">
          <main className="flex-1">
            <section className="section-shell">
              <div className="max-w-2xl mx-auto card-glass p-8 text-center">
                <h1 className="text-2xl font-bold mb-4 text-yellow-400">
                  {vendor.status === "pending" ? "Vendor Application Pending" : "Vendor Account Suspended"}
                </h1>
                <p className="text-muted mb-6">
                  {vendor.status === "pending"
                    ? "Your vendor application is currently under review. Once approved, you'll be able to edit events."
                    : "Your vendor account has been suspended. Please contact support for assistance."}
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

    const { id } = await params;
    return <EditEventForm eventId={id} />;
  } catch (error) {
    console.error("[vendors/events/[id]/edit] Error:", error);
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="max-w-2xl mx-auto card-glass p-8 text-center">
              <h1 className="text-2xl font-bold mb-4 text-red-400">Error Loading Page</h1>
              <p className="text-muted mb-6">
                An error occurred while loading this page. Please try again later.
              </p>
              <Link href="/vendors/events" className="btn-secondary">
                Back to Events
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }
}
