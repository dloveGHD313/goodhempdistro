"use client";

import { useState } from "react";
import {
  FOUNDING_PLAN_KEYS,
  type FoundingInterval,
  foundingFirstChargeDate,
  formatFoundingDate,
} from "@/lib/founding";

type PlanOption = { interval: FoundingInterval; label: string; price: string; note: string };

const OPTIONS: PlanOption[] = [
  { interval: "year", label: "Annual", price: "$2,805/year after the free year", note: "Best value — 15% off the monthly rate" },
  { interval: "month", label: "Monthly", price: "$275/month after the free year", note: "Cancel anytime before your first charge" },
];

/**
 * Founding checkout: pick monthly or annual Enterprise, then Stripe Checkout with a
 * 365-day trial (card on file, $0 today). The founding number is assigned when
 * Stripe confirms the session.
 */
export default function FoundingCheckout({ source, remaining }: { source: string | null; remaining: number }) {
  const [interval, setInterval] = useState<FoundingInterval>("year");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstCharge = formatFoundingDate(foundingFirstChargeDate());

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          planKey: FOUNDING_PLAN_KEYS[interval],
          cadence: interval === "year" ? "annual" : "monthly",
          tier: "Enterprise",
          founding: true,
          foundingSource: source ?? "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || "Could not start checkout. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Could not start checkout. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="card-glass border border-[var(--brand-lime)]/40 p-5 mb-6" data-testid="founding-checkout">
      <p className="text-sm text-muted mb-1">Step 2 of 2 · {remaining} of 100 spots left</p>
      <p className="text-xl font-bold mb-3">Lock in your founding year</p>
      <p className="text-sm text-muted mb-4">
        Vendor Enterprise (VIP) is free until <span className="text-white">{firstCharge}</span>. Choose how it bills
        after that, put a card on file, and pay <span className="text-white">$0 today</span>.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 mb-4" role="radiogroup" aria-label="Billing after the free year">
        {OPTIONS.map((o) => {
          const selected = o.interval === interval;
          return (
            <button
              key={o.interval}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setInterval(o.interval)}
              className={`text-left rounded-xl border p-4 transition ${
                selected
                  ? "border-[var(--brand-lime)] bg-[var(--brand-lime)]/10"
                  : "border-white/10 hover:border-white/30"
              }`}
              data-testid={`founding-plan-${o.interval}`}
            >
              <span className="block font-semibold">{o.label}</span>
              <span className="block text-sm text-muted">{o.price}</span>
              <span className="block text-xs text-[#C9A84C] mt-1">{o.note}</span>
            </button>
          );
        })}
      </div>
      {error && (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-3 text-red-300 text-sm mb-3" role="alert">
          {error}
        </div>
      )}
      <button type="button" onClick={start} disabled={loading} className="btn-primary" data-testid="founding-checkout-start">
        {loading ? "Opening secure checkout…" : "Continue to secure checkout — $0 today"}
      </button>
      <p className="text-xs text-muted mt-3">
        Card handled by Stripe. Your first charge is on {firstCharge}; cancel anytime before then from your vendor
        billing page and you pay nothing.
      </p>
    </div>
  );
}
