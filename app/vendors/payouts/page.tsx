import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import ConnectButton from "./ConnectButton";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ connected?: string; retry?: string }>;
};

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function maskId(id: string) {
  return `${id.slice(0, 8)}…`;
}

export default async function VendorPayoutsPage({ searchParams }: PageProps) {
  const resolved = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profile?.role !== "vendor") redirect("/");

  const { data: connect } = await supabase
    .from("vendor_connect_accounts")
    .select("stripe_account_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  const { data: payouts } = await supabase
    .from("affiliate_payouts")
    .select("scheduled_after, amount_cents, status, stripe_transfer_id")
    .eq("affiliate_user_id", session.user.id)
    .order("scheduled_after", { ascending: false });

  const isConnected = Boolean(connect?.stripe_account_id);

  return (
    <main className="section-shell text-white">
      <h1 className="text-4xl mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>Vendor Payouts</h1>
      <p className="mb-6 text-zinc-300" style={{ fontFamily: "'DM Sans', sans-serif" }}>Manage Stripe Connect and review affiliate payouts.</p>

      {resolved?.connected === "1" ? <div className="mb-4 rounded-md border border-green-500/40 bg-green-500/15 p-3 text-green-200">Stripe onboarding completed successfully.</div> : null}
      {resolved?.retry === "1" ? <div className="mb-4 rounded-md border border-yellow-500/40 bg-yellow-500/15 p-3 text-yellow-100">Please retry onboarding to finish Connect setup.</div> : null}

      <section className="rounded-lg border border-white/10 p-5 mb-6">
        <h2 className="text-2xl mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>Stripe Connect</h2>
        {!isConnected ? (
          <ConnectButton />
        ) : (
          <p style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <span style={{ color: "#3CB97A" }}>Connected ✓</span> {maskId(connect!.stripe_account_id)}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-white/10 p-5 overflow-x-auto">
        <h2 className="text-2xl mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>Payout History</h2>
        <table className="w-full text-left" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-2 pr-4">Scheduled</th><th className="py-2 pr-4">Amount</th><th className="py-2 pr-4">Status</th><th className="py-2">Transfer</th>
            </tr>
          </thead>
          <tbody>
            {(payouts ?? []).map((row, idx) => (
              <tr key={idx} className="border-b border-white/5">
                <td className="py-2 pr-4">{row.scheduled_after ? new Date(row.scheduled_after).toLocaleDateString("en-US") : "—"}</td>
                <td className="py-2 pr-4">{formatUsd(row.amount_cents ?? 0)}</td>
                <td className="py-2 pr-4">{row.status}</td>
                <td className="py-2">{row.stripe_transfer_id ? maskId(row.stripe_transfer_id) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
