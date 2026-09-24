import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Footer from "@/components/Footer";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getFoundingRow, getFoundingStats } from "@/lib/server/founding";
import {
  FOUNDING_CAP,
  FOUNDING_PERKS,
  formatFoundingDate,
  formatFoundingNumber,
  normalizeFoundingSource,
} from "@/lib/founding";
import FoundingCheckout from "./FoundingCheckout";
import FoundingConfirm from "./FoundingConfirm";

export const metadata: Metadata = {
  title: "Founding Members | Good Hemp Distro",
  description: `Good Hemp Distro is opening ${FOUNDING_CAP} founding spots: a full year of Vendor Enterprise (VIP) free, $0 today.`,
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function param(sp: Record<string, string | string[] | undefined>, key: string): string | null {
  const v = sp[key];
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? null : null;
}

/**
 * Founding Members landing page — the funnel the CEO shares (goodhempdistro.com/founding,
 * optionally ?ref=instagram / ?ref=email for attribution). 100 spots, live counter.
 * Signed-out: one CTA → /founding/go (cookie + sign-up). Signed-in: pick monthly or
 * annual Enterprise → Stripe Checkout with a 365-day trial → founding number.
 */
export default async function FoundingPage({ searchParams }: Props) {
  const sp = await searchParams;
  const ref = normalizeFoundingSource(param(sp, "ref"));
  const justClaimed = param(sp, "claimed") === "1";
  const canceled = param(sp, "canceled") === "1";
  const sessionId = param(sp, "session_id");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [stats, row] = await Promise.all([getFoundingStats(), getFoundingRow(user?.id)]);
  const active = row?.status === "active" && row.founding_number != null ? row : null;
  const full = stats.remaining <= 0;
  const goHref = `/founding/go${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`;
  const pct = Math.round((stats.claimed / stats.cap) * 100);
  const source = ref ?? row?.source ?? null;

  let panel: React.ReactNode;
  if (active) {
    panel = (
      <div className="card-glass border border-[var(--brand-lime)]/40 p-5 mb-6" data-testid="founding-claimed">
        <p className="text-sm text-muted mb-1">{justClaimed ? "Locked in." : "You're in."}</p>
        <p className="text-2xl font-bold text-accent">Founding Member {formatFoundingNumber(active.founding_number!)}</p>
        <p className="text-sm text-muted mt-2">
          Vendor Enterprise (VIP) is yours, free
          {active.trial_end ? ` until ${formatFoundingDate(active.trial_end)}` : " for a full year"}
          {active.billing_interval ? `, then ${active.billing_interval === "year" ? "annual" : "monthly"} billing` : ""}.
          Next: finish your vendor registration so your storefront can go live.
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <Link href="/vendor-registration" className="btn-primary">Finish vendor registration</Link>
          <Link href="/vendors/dashboard" className="btn-secondary">Vendor dashboard</Link>
        </div>
      </div>
    );
  } else if (user && sessionId && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    panel = <FoundingConfirm sessionId={sessionId} />;
  } else if (full) {
    panel = (
      <div className="card-glass p-5 mb-6" data-testid="founding-full">
        <p className="text-xl font-semibold text-accent-orange">All {FOUNDING_CAP} founding spots are taken.</p>
        <p className="text-sm text-muted mt-2">You can still apply as a vendor — the marketplace is open.</p>
        <div className="flex flex-wrap gap-3 mt-4">
          <Link href="/vendor-registration" className="btn-primary">Apply as a vendor</Link>
          <Link href="/pricing?tab=vendor" className="btn-secondary">See vendor plans</Link>
        </div>
      </div>
    );
  } else if (user) {
    panel = (
      <>
        {canceled && (
          <p className="text-sm text-[#C9A84C] mb-3" data-testid="founding-canceled">
            Checkout was closed before finishing — your spot isn&apos;t locked in yet. Pick a plan to try again.
          </p>
        )}
        <FoundingCheckout source={source} remaining={stats.remaining} />
      </>
    );
  } else {
    panel = (
      <div className="mb-6">
        <a href={goHref} className="btn-primary" data-testid="founding-cta">
          Claim my founding spot — $0 today
        </a>
        <p className="text-xs text-muted mt-2">
          Step 1: create your account. Step 2: pick monthly or annual and put a card on file. First charge in one year.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell hero-glow">
          <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr] items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[#C9A84C] mb-3" data-testid="founding-kicker">
                Founding Members · {FOUNDING_CAP} spots
              </p>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
                A full year of <span className="text-accent">Vendor Enterprise</span>, free — for the first {FOUNDING_CAP}.
              </h1>
              <p className="text-lg text-muted mb-6 max-w-xl">
                Good Hemp Distro is a marketplace for the whole hemp industry — building materials, textiles, food,
                everyday goods and the people who make them. Founding members sell on our top plan for a year at $0,
                keep a permanent founding number, and help decide what gets built next.
              </p>

              {panel}

              <div className="max-w-md" data-testid="founding-counter">
                <div className="flex justify-between text-sm text-muted mb-1">
                  <span>{stats.claimed} of {stats.cap} claimed</span>
                  <span>{stats.remaining} left</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--brand-lime)] transition-all"
                    style={{ width: `${Math.max(pct, stats.claimed > 0 ? 3 : 0)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-sm">
              <Image
                src="/mascot/jax/outfits/vendor.png"
                alt="JAX, the Good Hemp Distro mascot"
                width={640}
                height={640}
                className="w-full h-auto drop-shadow-[0_25px_60px_rgba(0,0,0,0.6)]"
                priority
              />
            </div>
          </div>
        </section>

        <section className="section-shell section-shell--tight">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="card-glass p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-[#C9A84C] mb-2">The offer</p>
              <h2 className="text-2xl font-bold mb-3">What founding members get</h2>
              <ul className="space-y-2 text-sm">
                {FOUNDING_PERKS.map((perk) => (
                  <li key={perk} className="flex gap-2">
                    <span className="text-accent">✓</span>
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card-glass p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-[#C9A84C] mb-2">How it works</p>
              <ol className="space-y-3 text-sm text-muted">
                <li>
                  <span className="text-accent font-semibold">1. Claim.</span> Create your account — that reserves your
                  place in line.
                </li>
                <li>
                  <span className="text-accent font-semibold">2. Choose.</span> Monthly ($275/mo) or annual ($2,805/yr)
                  Enterprise billing for after the free year. Card on file through Stripe, $0 charged today.
                </li>
                <li>
                  <span className="text-accent font-semibold">3. You&apos;re in.</span> Your founding number is assigned
                  the moment Stripe confirms. Finish vendor registration and your storefront goes live on Enterprise.
                </li>
              </ol>
              <p className="text-xs text-muted mt-4">
                First charge is exactly one year after you lock in; cancel before then from your vendor billing page and
                you pay nothing. {FOUNDING_CAP} spots, first come first served.{" "}
                <Link href="/contact" className="text-accent hover:underline">Questions?</Link>
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
