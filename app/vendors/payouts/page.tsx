import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import ConnectButton from "./ConnectButton";
import ManageAccountButton from "./ManageAccountButton";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ connected?: string; retry?: string }>;
};

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function maskId(id: string) {
  return `${id.slice(0, 8)}…`;
}

type ReserveRow = {
  id: string;
  amount_cents: number;
  reason: string;
  held_until: string;
  order_id: string | null;
  notes: string | null;
};

type ConnectEventRow = {
  event_id: string;
  event_type: string;
  payload: unknown;
  created_at: string;
};

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

  // Vendor + Connect account lookup in parallel
  const [vendorResult, connectResult] = await Promise.all([
    supabase
      .from("vendors")
      .select("id, business_name, tier")
      .eq("owner_user_id", session.user.id)
      .maybeSingle(),
    supabase
      .from("vendor_connect_accounts")
      .select("stripe_account_id, charges_enabled, payouts_enabled, payout_schedule_preference")
      .eq("user_id", session.user.id)
      .maybeSingle(),
  ]);

  const vendor = (vendorResult.data ?? null) as {
    id: string;
    business_name: string | null;
    tier: string | null;
  } | null;
  const connect = (connectResult.data ?? null) as {
    stripe_account_id: string;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    payout_schedule_preference: string | null;
  } | null;
  const isConnected = Boolean(connect?.stripe_account_id);
  const isFullyEnabled = Boolean(connect?.charges_enabled && connect?.payouts_enabled);

  // Pending platform reserve (held funds not yet released to vendor).
  // Table populated by PR-C webhook on checkout.session.completed.
  let reserves: ReserveRow[] = [];
  if (vendor) {
    const { data } = await supabase
      .from("platform_reserve")
      .select("id, amount_cents, reason, held_until, order_id, notes")
      .eq("vendor_id", vendor.id)
      .is("released_at", null)
      .order("held_until", { ascending: true });
    reserves = (data ?? []) as ReserveRow[];
  }
  const totalReserveCents = reserves.reduce((sum, r) => sum + (r.amount_cents ?? 0), 0);

  // Recent Connect events for this vendor's Stripe account — last 30 days.
  // Bucketed into transfers, failures, disputes.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let events: ConnectEventRow[] = [];
  if (isConnected) {
    const { data } = await supabase
      .from("stripe_connect_events")
      .select("event_id, event_type, payload, created_at")
      .eq("stripe_account_id", connect!.stripe_account_id)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(50);
    events = (data ?? []) as ConnectEventRow[];
  }

  const transfers = events.filter(
    (e) => e.event_type === "transfer.created" || e.event_type === "payout.paid"
  );
  const failures = events.filter((e) => e.event_type === "payout.failed");
  const disputes = events.filter((e) => e.event_type === "charge.dispute.created");

  // Existing affiliate payouts (referral commissions — separate ledger)
  const { data: affiliatePayouts } = await supabase
    .from("affiliate_payouts")
    .select("scheduled_after, amount_cents, status, stripe_transfer_id")
    .eq("affiliate_user_id", session.user.id)
    .order("scheduled_after", { ascending: false });

  return (
    <main className="section-shell text-white">
      <h1 className="text-4xl mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
        Vendor Payouts
      </h1>
      <p className="mb-6 text-zinc-300" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        Stripe Connect status, pending platform reserve, recent transfers, and affiliate payouts.
      </p>

      {resolved?.connected === "1" ? (
        <div className="mb-4 rounded-md border border-green-500/40 bg-green-500/15 p-3 text-green-200">
          Stripe onboarding completed successfully.
        </div>
      ) : null}
      {resolved?.retry === "1" ? (
        <div className="mb-4 rounded-md border border-yellow-500/40 bg-yellow-500/15 p-3 text-yellow-100">
          Please retry onboarding to finish Connect setup.
        </div>
      ) : null}

      {/* Stripe Connect status + Manage account */}
      <section className="rounded-lg border border-white/10 p-5 mb-6">
        <h2 className="text-2xl mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
          Stripe Connect
        </h2>
        {!isConnected ? (
          <div className="flex flex-col gap-3">
            <p style={{ fontFamily: "'DM Sans', sans-serif" }} className="text-zinc-300">
              Connect a Stripe account to receive payouts on product sales.
            </p>
            <ConnectButton />
          </div>
        ) : (
          <div className="flex flex-col gap-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div className="flex items-center gap-3 flex-wrap">
              {isFullyEnabled ? (
                <span className="rounded-full bg-green-500/15 border border-green-500/40 px-3 py-1 text-sm text-green-200">
                  ✓ Active
                </span>
              ) : (
                <span className="rounded-full bg-yellow-500/15 border border-yellow-500/40 px-3 py-1 text-sm text-yellow-100">
                  ⚠ Onboarding incomplete — finish in Stripe to unlock payouts
                </span>
              )}
              <span className="text-sm text-zinc-400">Account: {maskId(connect!.stripe_account_id)}</span>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded border border-white/10 p-3">
                <dt className="text-zinc-400 mb-1">Charges enabled</dt>
                <dd>{connect!.charges_enabled ? "Yes" : "No"}</dd>
              </div>
              <div className="rounded border border-white/10 p-3">
                <dt className="text-zinc-400 mb-1">Payouts enabled</dt>
                <dd>{connect!.payouts_enabled ? "Yes" : "No"}</dd>
              </div>
              <div className="rounded border border-white/10 p-3">
                <dt className="text-zinc-400 mb-1">Payout schedule</dt>
                <dd>{connect!.payout_schedule_preference ? connect!.payout_schedule_preference : "Daily (default)"}</dd>
              </div>
            </dl>
            <ManageAccountButton />
            <p className="text-xs text-zinc-400">
              Schedule and bank-account changes happen in the Stripe Express dashboard.
              Click <em>Manage account</em> to update them.
            </p>
          </div>
        )}
      </section>

      {/* Pending platform reserve */}
      <section className="rounded-lg border border-white/10 p-5 mb-6">
        <h2 className="text-2xl mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
          Pending in reserve
        </h2>
        <p className="text-sm text-zinc-400 mb-4">
          Each completed order is held for 7 days before transferring to your Stripe account.
          This protects against chargebacks and refunds. Disputes extend the hold.
        </p>
        {reserves.length === 0 ? (
          <p className="text-zinc-300" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            No funds held in reserve right now.
          </p>
        ) : (
          <>
            <div className="rounded border border-[#3CB97A]/30 bg-[#3CB97A]/10 p-3 mb-4 text-[#3CB97A]">
              Total held: <strong>{formatUsd(totalReserveCents)}</strong> across {reserves.length}{" "}
              order{reserves.length === 1 ? "" : "s"}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                <thead>
                  <tr className="border-b border-white/10 text-sm text-zinc-400">
                    <th className="py-2 pr-4">Held until</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Reason</th>
                    <th className="py-2">Order</th>
                  </tr>
                </thead>
                <tbody>
                  {reserves.map((r) => (
                    <tr key={r.id} className="border-b border-white/5">
                      <td className="py-2 pr-4">{formatDate(r.held_until)}</td>
                      <td className="py-2 pr-4">{formatUsd(r.amount_cents)}</td>
                      <td className="py-2 pr-4 text-sm">{r.reason.replace(/_/g, " ")}</td>
                      <td className="py-2 text-sm">{r.order_id ? maskId(r.order_id) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Active disputes — shown above transfer history if present */}
      {disputes.length > 0 ? (
        <section className="rounded-lg border border-red-500/40 bg-red-500/10 p-5 mb-6">
          <h2 className="text-2xl mb-3 text-red-200" style={{ fontFamily: "'Playfair Display', serif" }}>
            Active disputes
          </h2>
          <p className="text-sm text-red-200 mb-4">
            {disputes.length} dispute{disputes.length === 1 ? "" : "s"} opened in the last 30 days.
            Funds for disputed orders are held until the dispute resolves. Respond promptly via the
            Stripe Express dashboard.
          </p>
          <ul className="space-y-2 text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {disputes.slice(0, 10).map((d) => (
              <li
                key={d.event_id}
                className="rounded border border-red-500/30 p-2 flex items-center justify-between"
              >
                <span>{formatDate(d.created_at)}</span>
                <span className="text-zinc-400">Event {maskId(d.event_id)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Recent transfers (last 30 days) */}
      <section className="rounded-lg border border-white/10 p-5 mb-6">
        <h2 className="text-2xl mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
          Recent transfers (last 30 days)
        </h2>
        {transfers.length === 0 ? (
          <p className="text-zinc-300" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            No transfers yet. Released reserves show up here after the 7-day hold.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <thead>
                <tr className="border-b border-white/10 text-sm text-zinc-400">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2">Event</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.event_id} className="border-b border-white/5">
                    <td className="py-2 pr-4">{formatDate(t.created_at)}</td>
                    <td className="py-2 pr-4 text-sm">{t.event_type.replace(/\./g, " ")}</td>
                    <td className="py-2 text-sm">{maskId(t.event_id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {failures.length > 0 ? (
          <div className="mt-4 rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-100">
            ⚠ {failures.length} payout failure{failures.length === 1 ? "" : "s"} in the last 30 days.
            Check your bank details in Stripe Express dashboard.
          </div>
        ) : null}
      </section>

      {/* Fee transparency */}
      <section
        className="rounded-lg border border-white/10 p-5 mb-6 text-sm"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <h2 className="text-lg mb-2 text-zinc-300">How payouts work</h2>
        <ul className="space-y-1 text-zinc-400 list-disc list-inside">
          <li>Platform fee is deducted automatically per order (your tier&apos;s rate).</li>
          <li>Each order is held in reserve for 7 days before transferring to your Stripe account.</li>
          <li>Stripe charges $0.25 per outbound payout to your bank. This is paid by you, transparently.</li>
          <li>Choose payout cadence (daily, weekly, monthly) in your Stripe Express dashboard.</li>
          <li>Disputes hold the related order&apos;s funds until resolution.</li>
        </ul>
      </section>

      {/* Existing affiliate / referral payouts — separate ledger */}
      <section className="rounded-lg border border-white/10 p-5 overflow-x-auto">
        <h2 className="text-2xl mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
          Affiliate payouts
        </h2>
        <p className="text-sm text-zinc-400 mb-4">
          Referral commissions you&apos;ve earned by inviting other vendors or customers.
          Separate from product-sale payouts above.
        </p>
        {(affiliatePayouts ?? []).length === 0 ? (
          <p className="text-zinc-300" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            No affiliate payouts yet.
          </p>
        ) : (
          <table className="w-full text-left" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <thead>
              <tr className="border-b border-white/10 text-sm text-zinc-400">
                <th className="py-2 pr-4">Scheduled</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Transfer</th>
              </tr>
            </thead>
            <tbody>
              {(affiliatePayouts ?? []).map((row, idx) => (
                <tr key={idx} className="border-b border-white/5">
                  <td className="py-2 pr-4">
                    {row.scheduled_after ? formatDate(row.scheduled_after) : "—"}
                  </td>
                  <td className="py-2 pr-4">{formatUsd(row.amount_cents ?? 0)}</td>
                  <td className="py-2 pr-4">{row.status}</td>
                  <td className="py-2">{row.stripe_transfer_id ? maskId(row.stripe_transfer_id) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
