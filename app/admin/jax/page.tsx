import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import JaxAdminClient from "./JaxAdminClient";

export const dynamic = "force-dynamic";

/**
 * Learning with JAX — episode manager (brief 2026-07-16 P1 §3).
 * Closes the "jax_episodes has no admin UI" follow-up from #209. Uploads
 * are direct-to-storage via signed URLs (#215 pattern).
 */
export default async function JaxAdminPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin/jax");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  return (
    <div className="min-h-screen text-white">
      <main className="section-shell">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-accent mb-1">Learning with JAX — Episodes</h1>
          <p className="text-muted text-sm mb-6">
            draft → in review → approved → published. An <strong>approved</strong> episode with a
            publish time goes live automatically at that time (paid tiers unlock early per their
            window). Teasers are public once the episode is visible.
          </p>
          <JaxAdminClient />
        </div>
      </main>
    </div>
  );
}
