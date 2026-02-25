import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";
import Footer from "@/components/Footer";
import WholesaleAdminClient from "./WholesaleAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminWholesalePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/admin/wholesale");
  }

  const adminClient = getSupabaseAdminClient();
  const { data: adminRow } = await adminClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const isAdmin = !!adminRow;

  if (!isAdmin) {
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
