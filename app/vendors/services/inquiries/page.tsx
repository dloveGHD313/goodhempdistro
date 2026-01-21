import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import { hasVendorContext } from "@/lib/authz";
import Footer from "@/components/Footer";
import InquiriesClient from "./InquiriesClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getVendorInquiries(userId: string) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Get vendor
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id, owner_user_id")
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (!vendor) {
      return null;
    }

    // Get all inquiries for this vendor
    const { data: inquiries, error } = await supabase
      .from("service_inquiries")
      .select(`
        id,
        service_id,
        requester_name,
        requester_email,
        requester_phone,
        message,
        status,
        vendor_note,
        created_at,
        updated_at,
        services!service_inquiries_service_id_fkey(
          id,
          name,
          title,
          slug
        )
      `)
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[vendors/inquiries] Error fetching inquiries:", error);
      return { inquiries: [], error: error.message };
    }

    // Group by status
    const newInquiries = (inquiries || []).filter(i => i.status === 'new');
    const replied = (inquiries || []).filter(i => i.status === 'replied');
    const closed = (inquiries || []).filter(i => i.status === 'closed');

    // Normalize services relation
    const normalizedInquiries = (inquiries || []).map((inq: any) => ({
      ...inq,
      services: Array.isArray(inq.services) ? inq.services[0] : inq.services,
    }));

    return {
      inquiries: normalizedInquiries,
      counts: {
        new: newInquiries.length,
        replied: replied.length,
        closed: closed.length,
        total: (inquiries || []).length,
      },
    };
  } catch (err) {
    console.error("[vendors/inquiries] Error in getVendorInquiries:", err);
    return { inquiries: [], counts: { new: 0, replied: 0, closed: 0, total: 0 } };
  }
}

export default async function VendorInquiriesPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/vendors/services/inquiries");
  }

  // Check vendor context
  const { hasContext } = await hasVendorContext(supabase, user.id);

  if (!hasContext) {
    redirect("/vendor-registration");
  }

  const inquiriesData = await getVendorInquiries(user.id);

  if (!inquiriesData) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="card-glass p-8 text-center">
              <h1 className="text-2xl font-bold mb-4 text-red-400">Vendor Account Not Found</h1>
              <p className="text-muted mb-6">
                Your vendor account could not be found. Please contact support.
              </p>
              <a href="/vendors/dashboard" className="btn-secondary">
                Back to Dashboard
              </a>
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
          <h1 className="text-4xl font-bold mb-8 text-accent">Service Inquiries</h1>
          <InquiriesClient 
            initialInquiries={inquiriesData.inquiries || []} 
            initialCounts={inquiriesData.counts || { new: 0, replied: 0, closed: 0, total: 0 }} 
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}
