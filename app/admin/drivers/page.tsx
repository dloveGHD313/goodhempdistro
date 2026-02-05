import { redirect } from "next/navigation";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";
import DriversClient from "./DriversClient";

export const dynamic = 'force-dynamic';

async function getDriversData() {
  const admin = getSupabaseAdminClient();

  const { data: applications } = await admin
    .from("driver_applications")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: drivers } = await admin
    .from("drivers")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: onDemandData, error: onDemandErr } = await admin
    .from("logistics_applications")
    .select("id, full_name, email, phone, service_area, vehicle_type, notes, status, created_at, reviewed_at, rejection_reason")
    .eq("type", "on_demand_driver")
    .order("created_at", { ascending: false });
  const onDemandApplications = onDemandErr ? [] : (onDemandData || []);

  return {
    applications: applications || [],
    drivers: drivers || [],
    onDemandApplications,
  };
}

export default async function AdminDriversPage() {
  const adminCheck = await requireAdmin();
  if (!adminCheck.user) {
    redirect("/login?redirect=/admin/drivers");
  }

  if (!adminCheck.isAdmin) {
    redirect("/");
  }

  const { applications, drivers, onDemandApplications } = await getDriversData();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Driver Management</h1>
          <DriversClient
            initialApplications={applications}
            initialDrivers={drivers}
            initialOnDemandApplications={onDemandApplications}
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}
