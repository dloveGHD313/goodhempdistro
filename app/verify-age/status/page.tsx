import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import { getUserVerificationStatus } from "@/lib/server/idVerification";

export const dynamic = "force-dynamic";

export default async function VerifyAgeStatusPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(`/login?redirect=${encodeURIComponent("/verify-age/status")}`);
  }

  const { data: verification } = await supabase
    .from("id_verifications")
    .select("id, status, created_at, reviewed_at, notes")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let files: { url: string; path: string }[] = [];
  if (verification?.id) {
    const { data: fileRows } = await supabase
      .from("id_verification_files")
      .select("file_path")
      .eq("verification_id", verification.id);

    const signed = await Promise.all(
      (fileRows || []).map(async (row) => {
        const { data } = await supabase
          .storage
          .from("id-verifications")
          .createSignedUrl(row.file_path, 60 * 60);
        return data?.signedUrl ? { url: data.signedUrl, path: row.file_path } : null;
      })
    );
    files = signed.filter(Boolean) as { url: string; path: string }[];
  }

  const normalizedStatus =
    verification?.status === "verified" ? "approved" : verification?.status;
  const statusLabel = normalizedStatus || "none";
  const statusTone =
    statusLabel === "approved"
      ? "border-green-500/40 text-green-300"
      : statusLabel === "rejected"
        ? "border-red-500/40 text-red-300"
        : "border-yellow-500/40 text-yellow-200";
  const summary = await getUserVerificationStatus(user.id);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-3xl mx-auto card-glass p-8 space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted mb-2">Verification Status</p>
              <h1 className="text-3xl font-bold text-accent">Your 21+ verification</h1>
            </div>

            <div className={`card-glass p-4 border ${statusTone}`}>
              <p className="text-sm">Status: {statusLabel}</p>
              {summary.reviewedAt && (
                <p className="text-xs text-muted mt-1">Reviewed at: {summary.reviewedAt}</p>
              )}
              {statusLabel === "rejected" && (
                <p className="text-xs text-muted mt-2">
                  Your submission was rejected. Please upload clearer ID images to retry.
                </p>
              )}
              {verification?.notes && (
                <p className="text-xs text-muted mt-2">Reviewer notes: {verification.notes}</p>
              )}
            </div>

            {!verification && (
              <div className="card-glass p-4 border border-[var(--border)] text-muted">
                No verification submitted yet.
              </div>
            )}

            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted">Submitted files</p>
                <ul className="space-y-1 text-sm">
                  {files.map((file) => (
                    <li key={file.path}>
                      <a
                        href={file.url}
                        className="text-accent hover:text-accent/80 underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        View file
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <a href="/verify-age/upload" className="btn-primary">
                {statusLabel === "rejected" ? "Submit new verification" : "Upload ID"}
              </a>
              <a href="/products" className="btn-secondary">
                Back to Products
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
