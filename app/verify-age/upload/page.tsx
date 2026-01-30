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
  const { data: latestVerification } = await supabase
    .from("id_verifications")
    .select("id, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let existingVerificationId: string | null = null;
  if (latestVerification?.id && latestVerification.status === "pending") {
    const { data: fileRows } = await supabase
      .from("id_verification_files")
      .select("id")
      .eq("verification_id", latestVerification.id);
    const fileCount = fileRows?.length ?? 0;
    if (fileCount < 2) {
      existingVerificationId = latestVerification.id;
    } else {
      redirect("/verify-age/status");
    }
  }

  if (verification.status === "approved") {
    redirect("/verify-age/status");
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <VerifyUploadClient
            userId={user.id}
            existingVerificationId={existingVerificationId}
            existingStatus={verification.status}
          />
        </section>
      </main>
      <Footer />
    </div>
  );
}
