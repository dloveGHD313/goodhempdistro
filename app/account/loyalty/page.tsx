import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase";
import Footer from "@/components/Footer";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AccountLoyaltyPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  if (!user) {
    redirect("/login?redirect=/account/loyalty");
  }

  let loyalty: { points_balance?: number; lifetime_points_earned?: number; updated_at?: string } | null = null;
  let events: Array<{ event_type: string; points_delta: number; metadata?: unknown; created_at: string }> = [];

  try {
    const hdrs = await headers();
    const proto = hdrs.get("x-forwarded-proto") ?? "https";
    const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
    const baseUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
    const cookie = hdrs.get("cookie") ?? "";
    const res = await fetch(`${baseUrl}/api/consumer/loyalty`, {
      headers: { cookie },
      cache: "no-store",
    });
    const data = await res.json();
    if (data.loyalty) loyalty = data.loyalty;
    if (Array.isArray(data.events)) events = data.events;
  } catch {
    // ignore
  }

  const balance = loyalty?.points_balance ?? 0;
  const lifetime = loyalty?.lifetime_points_earned ?? 0;

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Loyalty</h1>

          <div className="surface-card p-6 mb-8">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-sm text-muted">Points balance</div>
                <div className="text-2xl font-bold text-accent">{balance}</div>
              </div>
              <div>
                <div className="text-sm text-muted">Lifetime earned</div>
                <div className="text-2xl font-bold">{lifetime}</div>
              </div>
            </div>
            <p className="text-sm text-muted">
              Points are awarded on paid orders. Redeem from your account or subscription benefits.
            </p>
            <Link href="/account/subscription" className="btn-secondary mt-4 inline-block">
              Subscription &amp; benefits
            </Link>
          </div>

          <div className="surface-card p-6">
            <h2 className="text-xl font-semibold mb-4">Recent activity</h2>
            {events.length === 0 ? (
              <p className="text-muted">No loyalty events yet. Make a purchase to earn points.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {events.slice(0, 15).map((e, i) => (
                  <li key={i} className="flex justify-between border-b border-gray-700 pb-2">
                    <span className="text-gray-300">{e.event_type}</span>
                    <span className={e.points_delta >= 0 ? "text-green-400" : "text-red-400"}>
                      {e.points_delta >= 0 ? "+" : ""}{e.points_delta} pts
                    </span>
                    <span className="text-muted text-xs">{new Date(e.created_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6">
            <Link href="/account" className="btn-secondary">← Account</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
