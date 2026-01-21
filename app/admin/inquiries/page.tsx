import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { getCurrentUserProfile, isAdmin } from "@/lib/authz";
import Footer from "@/components/Footer";
import AdminInquiriesClient from "./AdminInquiriesClient";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getAllInquiries() {
  try {
    const admin = getSupabaseAdminClient();

    const { data: inquiries, error } = await admin
      .from("service_inquiries")
      .select(`
        id,
        service_id,
        vendor_id,
        owner_user_id,
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
        ),
        vendors!service_inquiries_vendor_id_fkey(
          id,
          business_name,
          owner_user_id
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin/inquiries] Error fetching inquiries:", error);
      return { inquiries: [], error: error.message };
    }

    // Normalize relations (handle array returns from Supabase)
    type RawInquiry = {
      id: string;
      service_id: string;
      vendor_id: string;
      owner_user_id: string;
      requester_name?: string;
      requester_email: string;
      requester_phone?: string;
      message: string;
      status: 'new' | 'replied' | 'closed';
      vendor_note?: string;
      created_at: string;
      updated_at: string;
      services?: { id: string; name?: string; title: string; slug?: string } | { id: string; name?: string; title: string; slug?: string }[];
      vendors?: { id: string; business_name: string; owner_user_id: string } | { id: string; business_name: string; owner_user_id: string }[];
    };

    const normalizedInquiries = (inquiries as RawInquiry[] || []).map((inq: RawInquiry) => ({
      id: inq.id,
      service_id: inq.service_id,
      vendor_id: inq.vendor_id,
      owner_user_id: inq.owner_user_id,
      requester_name: inq.requester_name,
      requester_email: inq.requester_email,
      requester_phone: inq.requester_phone,
      message: inq.message,
      status: inq.status,
      vendor_note: inq.vendor_note,
      created_at: inq.created_at,
      updated_at: inq.updated_at,
      services: Array.isArray(inq.services) ? inq.services[0] : inq.services || null,
      vendors: Array.isArray(inq.vendors) ? inq.vendors[0] : inq.vendors || null,
    }));

    return {
      inquiries: normalizedInquiries,
    };
  } catch (err) {
    console.error("[admin/inquiries] Error in getAllInquiries:", err);
    return { inquiries: [] };
  }
}

export default async function AdminInquiriesPage() {
  noStore();

  const supabase = await createSupabaseServerClient();
  const { user, profile } = await getCurrentUserProfile(supabase);

  if (!user) {
    redirect("/login?redirect=/admin/inquiries");
  }

  if (!isAdmin(profile)) {
    redirect("/dashboard");
  }

  const inquiriesData = await getAllInquiries();

  console.log(`[admin/inquiries] Admin ${user.id} viewing ${inquiriesData.inquiries?.length || 0} inquiries`);

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
