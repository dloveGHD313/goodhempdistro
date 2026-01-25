import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";
import ComplianceClient from "./ComplianceClient";

export const dynamic = 'force-dynamic';

async function getComplianceData() {
  const admin = getSupabaseAdminClient();

  const { data: vendors } = await admin
    .from("vendors")
    .select("id, business_name, coa_attested, coa_attested_at, intoxicating_policy_ack, intoxicating_policy_ack_at, status, created_at")
    .order("created_at", { ascending: false });

  const { data: products } = await admin
    .from("products")
    .select("id, name, product_type, coa_url, coa_object_path, coa_verified, delta8_disclaimer_ack, vendor_id, vendors!inner(business_name)")
    .order("created_at", { ascending: false });

  const productsWithCoaUrls = await Promise.all(
    (products || []).map(async (product: any) => {
      if (!product.coa_object_path) {
        return { ...product, coa_review_url: null };
      }
      const { data } = await admin.storage
        .from("coas")
        .createSignedUrl(product.coa_object_path, 60 * 10);
      return { ...product, coa_review_url: data?.signedUrl || null };
    })
  );

  return {
    vendors: vendors || [],
    products: productsWithCoaUrls || [],
  };
}

export default async function AdminCompliancePage() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/compliance");
  }

  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  const { vendors, products } = await getComplianceData();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Compliance Management</h1>
          <ComplianceClient initialVendors={vendors} initialProducts={products} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
