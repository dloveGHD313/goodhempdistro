"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useEffect, useState } from "react";
import Footer from "@/components/Footer";

type PayScale = {
  base_pay_driver: number;
  per_mile_driver: number;
  minimum_miles: number;
  minimum_payout_driver: number;
  formula_note: string;
};

type PayScaleState =
  | { status: "loading" }
  | { status: "ready"; data: PayScale }
  | { status: "empty" }
  | { status: "error"; message: string };

export default function LogisticsPage() {
  const [payScaleState, setPayScaleState] = useState<PayScaleState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setPayScaleState({ status: "loading" });
    fetch("/api/logistics/pay-scale")
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          if (res.status === 404) {
            setPayScaleState({ status: "empty" });
            return;
          }
          return res.json().then((body: { message?: string; error?: string }) => {
            const msg = body?.message ?? body?.error ?? (res.status >= 500 ? "Unable to load pay scale" : "Failed to load pay scale");
            setPayScaleState({ status: "error", message: msg });
          });
        }
        return res.json().then((data: PayScale) => {
          if (cancelled) return;
          if (data && typeof data.base_pay_driver === "number" && typeof data.per_mile_driver === "number") {
            setPayScaleState({ status: "ready", data });
          } else {
            setPayScaleState({ status: "empty" });
          }
        });
      })
      .catch(() => {
        if (!cancelled) setPayScaleState({ status: "error", message: "Network error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold mb-6 text-accent">Local B2B Delivery Network</h1>
            <p className="text-muted mb-8">
              Connect your business with local delivery drivers for fast, reliable B2B deliveries.
            </p>

            <div className="grid gap-6 md:grid-cols-3 mb-8">
              <Link
                href="/logistics/apply"
                className="card-glass p-6 text-center hover:border-accent/50 transition border-2 border-transparent rounded-xl"
              >
                <h2 className="text-xl font-semibold mb-2">Apply as Driver</h2>
                <p className="text-muted text-sm mb-4">
                  Join the driver network or register your logistics company.
                </p>
                <span className="text-accent font-medium">Get started →</span>
              </Link>

              <Link
                href="/logistics/request"
                className="card-glass p-6 text-center hover:border-accent/50 transition border-2 border-transparent rounded-xl"
              >
                <h2 className="text-xl font-semibold mb-2">Request Delivery</h2>
                <p className="text-muted text-sm mb-4">
                  Submit a delivery request for your business needs.
                </p>
                <span className="text-accent font-medium">Request now →</span>
              </Link>

              <Link
                href="/logistics/apply"
                className="card-glass p-6 text-center hover:border-accent/50 transition border-2 border-transparent rounded-xl"
              >
                <h2 className="text-xl font-semibold mb-2">Register Logistics Company</h2>
                <p className="text-muted text-sm mb-4">
                  List your company in our directory or join the on-demand network.
                </p>
                <span className="text-accent font-medium">Register →</span>
              </Link>
            </div>

            <div className="flex flex-wrap gap-3 justify-center mb-8">
              <Link href="/driver/dashboard" className="btn-secondary">
                Driver dashboard
              </Link>
              <Link href="/logistics/dashboard" className="btn-secondary">
                Logistics dashboard
              </Link>
              <Link href="/logistics/routes" className="btn-ghost">
                Preview delivery matching
              </Link>
            </div>

            <div className="card-glass p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4">Pay Scale</h2>
              <p className="text-muted mb-4">Simple, transparent pricing for local deliveries.</p>
              {payScaleState.status === "loading" && (
                <p className="text-muted">Loading…</p>
              )}
              {payScaleState.status === "error" && (
                <p className="text-amber-400">{payScaleState.message}</p>
              )}
              {payScaleState.status === "empty" && (
                <p className="text-muted">Pay scale is not configured yet.</p>
              )}
              {payScaleState.status === "ready" && (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="border-b border-[var(--border)]">
                        <tr>
                          <th className="pb-3 font-semibold text-muted">Component</th>
                          <th className="pb-3 font-semibold text-muted">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-[var(--border)]/60">
                          <td className="py-3 text-muted">Base Pay</td>
                          <td className="py-3 font-semibold">${payScaleState.data.base_pay_driver.toFixed(2)}</td>
                        </tr>
                        <tr className="border-b border-[var(--border)]/60">
                          <td className="py-3 text-muted">Per Mile</td>
                          <td className="py-3 font-semibold">${payScaleState.data.per_mile_driver.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="py-3 text-muted">Minimum Payout</td>
                          <td className="py-3 font-semibold">${payScaleState.data.minimum_payout_driver.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-sm text-muted mt-4">{payScaleState.data.formula_note}</p>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
