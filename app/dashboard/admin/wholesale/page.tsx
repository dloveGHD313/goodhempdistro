import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";
import WholesaleAdminClient from "./WholesaleAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminWholesalePage() {
  const adminCheck = await requireAdmin();

  if (!adminCheck.user) {
    redirect("/login?redirect=/dashboard/admin/wholesale");
  }

  if (!adminCheck.isAdmin) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="surface-card p-8 text-center">
              <h1 className="text-2xl font-bold mb-4 text-red-400">Not Authorized</h1>
              <p className="text-muted">You must be an admin to access wholesale applications.</p>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-6xl mx-auto">
            <WholesaleAdminClient />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
