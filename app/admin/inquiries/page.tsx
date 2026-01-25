import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";
import AdminInquiriesClient from "./AdminInquiriesClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getAllInquiries() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/admin/inquiries`, { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      console.error("[admin/inquiries] Error fetching inquiries:", payload);
      return { inquiries: [], error: payload?.error || "Failed to load inquiries" };
    }

    return { inquiries: payload.data || [] };
  } catch (err) {
    console.error("[admin/inquiries] Error in getAllInquiries:", err);
    return { inquiries: [] };
  }
}

export default async function AdminInquiriesPage() {
  noStore();

  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/inquiries");
  }

  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  const inquiriesData = await getAllInquiries();

  console.log(
    `[admin/inquiries] Admin ${adminCheck.user.id} viewing ${inquiriesData.inquiries?.length || 0} inquiries`
  );

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Service Inquiries</h1>
          <AdminInquiriesClient initialInquiries={inquiriesData.inquiries || []} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
