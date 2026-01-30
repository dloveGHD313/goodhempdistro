import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import VerifyUploadClient from "./VerifyUploadClient";

export const dynamic = "force-dynamic";

export default async function VerifyUploadPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(`/login?redirect=${encodeURIComponent("/verify/upload")}`);
  }

  const { data: existing } = await supabase
    .from("id_verifications")
    .select("id, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.status === "pending" || existing?.status === "verified") {
    redirect("/verify/status");
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <VerifyUploadClient userId={user.id} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
