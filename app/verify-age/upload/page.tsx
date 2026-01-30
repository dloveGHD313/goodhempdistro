import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import VerifyUploadClient from "@/app/verify/upload/VerifyUploadClient";
import { getUserVerificationStatus } from "@/lib/server/idVerification";

export const dynamic = "force-dynamic";

export default async function VerifyAgeUploadPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(`/login?redirect=${encodeURIComponent("/verify-age/upload")}`);
  }

  const verification = await getUserVerificationStatus(user.id);
  if (verification.status === "pending" || verification.status === "approved") {
    redirect("/verify-age/status");
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
