import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";
import AdminInquiriesClient from "./AdminInquiriesClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminInquiriesPage() {
  noStore();

  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/inquiries");
  }

  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Service Inquiries</h1>
          <AdminInquiriesClient initialInquiries={[]} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
