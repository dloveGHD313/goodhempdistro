import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";
import LogisticsClient from "./LogisticsClient";

export const dynamic = 'force-dynamic';

async function getLogisticsData() {
  const admin = getSupabaseAdminClient();

  const { data: applications } = await admin
    .from("logistics_applications")
    .select("*")
    .order("created_at", { ascending: false });

  return {
    applications: applications || [],
  };
}

export default async function AdminLogisticsPage() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/logistics");
  }

  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  const { applications } = await getLogisticsData();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Logistics Management</h1>
          <LogisticsClient initialApplications={applications} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
