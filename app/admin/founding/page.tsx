import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import Footer from "@/components/Footer";
import { listFoundingMembers } from "@/lib/server/founding";
import { FOUNDING_CAP, formatFoundingDate, formatFoundingNumber } from "@/lib/founding";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function when(iso: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  return Number.isFinite(t)
    ? new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })
    : "—";
}

/** Admin roster of founding members — confirmed (numbered) first, then people still in the funnel. */
export default async function AdminFoundingPage() {
  noStore();
  const adminCheck = await requireAdmin();
  if (!adminCheck.user) redirect("/login?redirect=/admin/founding");
  if (!adminCheck.isAdmin) redirect("/");

  const rows = await listFoundingMembers();
  const active = rows.filter((r) => r.status === "active");
  const pending = rows.filter((r) => r.status !== "active");

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-bold text-accent">Founding Members</h1>
              <p className="text-muted mt-2">
                <span className="text-white font-semibold">{active.length}</span> of {FOUNDING_CAP} confirmed ·{" "}
                {FOUNDING_CAP - active.length} left · {pending.length} in the funnel (signed up, no card yet).
              </p>
              <p className="text-muted text-sm mt-1">
                Share link: <code className="text-white">goodhempdistro.com/founding</code> — add{" "}
                <code>?ref=instagram</code>, <code>?ref=email</code>… to see where people came from. Confirmed = Stripe
                has their card and the Enterprise trial is running; the first charge date is shown per member.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/founding" className="btn-secondary">View funnel page</Link>
              <a href="/api/admin/founding/export" className="btn-primary">Download CSV</a>
            </div>
          </div>

          <div className="card-glass overflow-x-auto">
            <table className="w-full text-sm" data-testid="founding-admin-table">
              <thead className="text-left text-muted border-b border-white/10">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Business</th>
                  <th className="p-3">Billing after trial</th>
                  <th className="p-3">First charge</th>
                  <th className="p-3">Source</th>
                  <th className="p-3">Signed up</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td className="p-6 text-muted" colSpan={9}>
                      No founding members yet. The first person to finish checkout through /founding becomes #001.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.user_id} className="border-b border-white/5 align-top">
                    <td className="p-3 font-semibold text-accent">
                      {r.founding_number != null ? formatFoundingNumber(r.founding_number) : "—"}
                    </td>
                    <td className="p-3">
                      {r.status === "active" ? (
                        <span className="text-accent">Confirmed</span>
                      ) : r.stripe_checkout_session_id ? (
                        <span className="text-[#C9A84C]">Checkout open</span>
                      ) : (
                        <span className="text-muted">Signed up</span>
                      )}
                      {r.subscription_status && (
                        <span className="block text-xs text-muted">Stripe: {r.subscription_status}</span>
                      )}
                    </td>
                    <td className="p-3">{r.display_name ?? "—"}</td>
                    <td className="p-3">{r.email ?? "—"}</td>
                    <td className="p-3">
                      {r.vendor_business_name ?? "—"}
                      {r.vendor_status && <span className="block text-xs text-muted capitalize">{r.vendor_status}</span>}
                    </td>
                    <td className="p-3">
                      {r.billing_interval ? (r.billing_interval === "year" ? "Enterprise annual" : "Enterprise monthly") : "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap">{formatFoundingDate(r.trial_end) ?? "—"}</td>
                    <td className="p-3">{r.source ?? "—"}</td>
                    <td className="p-3 whitespace-nowrap">{when(r.claimed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted mt-4">
            Founding members are separate from ordinary paying vendors: they hold a founding number and their Enterprise
            plan is on a one-year Stripe trial. Ordinary vendors who buy a plan on /pricing never appear here.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
