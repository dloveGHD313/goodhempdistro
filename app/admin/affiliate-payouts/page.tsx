import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const metadata: Metadata = {
  title: "Affiliate Payouts | Admin — Good Hemp Distro",
};

async function approvePayout(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  if (!id) return;

  await getSupabaseAdminClient()
    .from("affiliate_payouts")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");

  redirect("/admin/affiliate-payouts?updated=1");
}

async function markAsPaid(formData: FormData) {
  "use server";
  const id = formData.get("id") as string;
  if (!id) return;

  await getSupabaseAdminClient()
    .from("affiliate_payouts")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "approved");

  redirect("/admin/affiliate-payouts?updated=1");
}

async function approveAllPending() {
  "use server";
  await getSupabaseAdminClient()
    .from("affiliate_payouts")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("status", "pending");

  redirect("/admin/affiliate-payouts?bulk=1");
}

type AffiliatePayout = {
  id: string;
  created_at: string;
  updated_at: string;
  affiliate_user_id: string | null;
  referral_event_id: string;
  instalment_number: number;
  amount_cents: number;
  plan_key: string;
  plan_cadence: string;
  status: string;
  scheduled_after: string | null;
  paid_at: string | null;
  notes: string | null;
  stripe_transfer_id: string | null;
};

export default async function AdminAffiliatePayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; updated?: string; bulk?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/admin/affiliate-payouts");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/");

  const params = await searchParams;
  const filterStatus = params.status || "all";

  const admin = getSupabaseAdminClient();

  let query = admin
    .from("affiliate_payouts")
    .select("*")
    .order("created_at", { ascending: false });

  if (filterStatus !== "all") query = query.eq("status", filterStatus);

  const { data: payouts, error } = await query;
  const allPayouts = (payouts ?? []) as AffiliatePayout[];

  const userIds = [
    ...new Set(allPayouts.map((p) => p.affiliate_user_id).filter(Boolean) as string[]),
  ];
  const emailMap: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await admin.from("profiles").select("id, email").in("id", userIds);
    for (const p of profiles ?? []) {
      if (p.id && p.email) emailMap[p.id] = p.email;
    }
  }

  const { data: allPayoutsForStats } = await admin
    .from("affiliate_payouts")
    .select("status, amount_cents");

  const statsData = allPayoutsForStats ?? [];
  const pendingCount = statsData.filter((p) => p.status === "pending").length;
  const pendingCents = statsData
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);
  const paidCount = statsData.filter((p) => p.status === "paid").length;
  const paidCents = statsData
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);

  const pendingCsv = allPayouts
    .filter((p) => p.status === "pending")
    .map((p) => {
      const email = p.affiliate_user_id ? (emailMap[p.affiliate_user_id] ?? "") : "";
      return `${p.id},${email},${(p.amount_cents / 100).toFixed(2)},${p.plan_key},${p.plan_cadence},${p.instalment_number}`;
    })
    .join("\n");

  return (
    <main className="section-shell text-white">
      <div className="max-w-6xl mx-auto">
        <Link href="/admin" className="text-xs text-muted hover:text-accent inline-block mb-2">
          ← Admin Dashboard
        </Link>
        <div className="flex flex-col md:flex-row md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-accent">Affiliate Payouts</h1>
            <p className="text-muted mt-1">Queue approvals only. CEO executes Stripe transfers manually.</p>
          </div>
          {pendingCount > 0 && (
            <form action={approveAllPending}>
              <button type="submit" className="btn-primary">✅ Approve All Pending ({pendingCount})</button>
            </form>
          )}
        </div>

        {params.updated === "1" && <div className="mb-4 p-3 rounded bg-green-500/20">✅ Payout status updated.</div>}
        {params.bulk === "1" && <div className="mb-4 p-3 rounded bg-green-500/20">✅ Pending payouts approved.</div>}
        {error && <div className="mb-4 p-3 rounded bg-red-500/20">Error loading payouts: {error.message}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="surface-glass rounded-xl p-4 border border-white/10"><p className="text-2xl text-yellow-300">{pendingCount}</p><p className="text-xs text-muted">Total pending</p></div>
          <div className="surface-glass rounded-xl p-4 border border-white/10"><p className="text-2xl text-yellow-300">${(pendingCents / 100).toFixed(2)}</p><p className="text-xs text-muted">Total pending $</p></div>
          <div className="surface-glass rounded-xl p-4 border border-white/10"><p className="text-2xl text-green-300">${(paidCents / 100).toFixed(2)}</p><p className="text-xs text-muted">Total paid $</p></div>
          <div className="surface-glass rounded-xl p-4 border border-white/10"><p className="text-2xl text-green-300">{paidCount}</p><p className="text-xs text-muted">Count paid</p></div>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {["all", "pending", "approved", "paid", "forfeited"].map((s) => (
            <Link key={s} href={`/admin/affiliate-payouts${s === "all" ? "" : `?status=${s}`}`} className={`px-4 py-2 rounded-lg text-sm ${filterStatus === s ? "bg-accent text-black" : "surface-glass border border-white/10 text-muted"}`}>
              {s[0].toUpperCase() + s.slice(1)}
            </Link>
          ))}
        </div>

        {allPayouts.length === 0 ? <div className="surface-glass rounded-xl p-8 border border-white/10 text-muted">No payouts found.</div> : (
          <div className="space-y-4">
            {allPayouts.map((payout) => {
              const email = payout.affiliate_user_id ? (emailMap[payout.affiliate_user_id] ?? payout.affiliate_user_id) : "Unknown affiliate";
              return (
                <div key={payout.id} className="surface-card rounded-xl p-5 border border-white/10">
                  <div className="flex justify-between gap-3 flex-wrap mb-3">
                    <div>
                      <p className="font-semibold">{email}</p>
                      <p className="text-sm text-muted">{payout.plan_key} · {payout.plan_cadence} · Instalment {payout.instalment_number}</p>
                    </div>
                    <p className="text-accent text-2xl font-bold">${(payout.amount_cents / 100).toFixed(2)}</p>
                  </div>
                  <div className="text-xs text-muted space-y-1 mb-3">
                    <p>Status: {payout.status}</p>
                    {payout.scheduled_after && <p>Eligible after: {new Date(payout.scheduled_after).toLocaleDateString("en-US")}</p>}
                    {payout.notes && <p>Notes: {payout.notes}</p>}
                    <p className="font-mono opacity-70">ID: {payout.id}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap pt-3 border-t border-white/10">
                    {payout.status === "pending" && <form action={approvePayout}><input type="hidden" name="id" value={payout.id} /><button type="submit" className="px-4 py-2 rounded-lg bg-blue-500/20 text-blue-300 text-xs">✅ Approve</button></form>}
                    {payout.status === "approved" && <form action={markAsPaid}><input type="hidden" name="id" value={payout.id} /><button type="submit" className="px-4 py-2 rounded-lg bg-green-500/20 text-green-300 text-xs">💸 Mark as Paid</button></form>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="surface-glass rounded-xl p-4 border border-white/10 mt-8">
          <p className="font-semibold mb-2">Pending Payout Export (CSV)</p>
          <pre className="text-xs text-muted whitespace-pre-wrap">id,email,amount,plan_key,plan_cadence,instalment_number{"\n"}{pendingCsv || "(no pending payouts)"}</pre>
        </div>
      </div>
    </main>
  );
}
