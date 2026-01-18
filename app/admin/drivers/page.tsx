import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import Footer from "@/components/Footer";
import DriversClient from "./DriversClient";

export const dynamic = 'force-dynamic';

async function getDriversData() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/admin/drivers`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return { applications: [], drivers: [] };
  }

  return response.json();
}

export default async function AdminDriversPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/admin/drivers");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const { applications, drivers } = await getDriversData();

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Driver Management</h1>
          <DriversClient initialApplications={applications} initialDrivers={drivers} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
