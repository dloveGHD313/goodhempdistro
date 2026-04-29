import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { resolveIsAdmin } from "@/lib/server/isAdmin";
import TriggerPayoutsButton from "./TriggerPayoutsButton";

export const dynamic = "force-dynamic";

export default async function AdminPayoutsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;
  if (!user?.email) {
    redirect("/login?redirect=/admin/payouts");
  }

  const isAdmin = await resolveIsAdmin(user.id, user.email);
  if (!isAdmin) {
    redirect("/");
  }

  const now = new Date().toISOString();
  const { count } = await supabase
    .from("affiliate_payouts")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .lte("scheduled_after", now);

  return (
    <main className="section-shell text-white">
      <h1 className="text-3xl font-bold text-accent mb-2">Admin Payout Trigger</h1>
      <p className="text-muted mb-6">Pending eligible payouts: {count ?? 0}</p>
      <TriggerPayoutsButton />
    </main>
  );
}
