"use client";

import { useState } from "react";
import Link from "next/link";
import Footer from "@/components/Footer";

export default function LogisticsApplyPage() {
  const [selected, setSelected] = useState<"provider" | "driver" | null>(null);
  const [driverForm, setDriverForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    service_area: "",
    vehicle_type: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/logistics/apply/on-demand-driver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: driverForm.full_name.trim(),
          email: driverForm.email.trim(),
          phone: driverForm.phone.trim() || undefined,
          service_area: driverForm.service_area.trim() || undefined,
          vehicle_type: driverForm.vehicle_type.trim() || undefined,
          notes: driverForm.notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit");
        setSubmitting(false);
        return;
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold mb-2 text-accent">How do you want to work with Good Hemp Distro?</h1>
            <p className="text-muted mb-8">Choose one option below.</p>

            {success ? (
              <div className="card-glass p-6 text-center">
                <h2 className="text-2xl font-bold mb-4 text-green-400">Application received</h2>
                <p className="text-muted">We&apos;ll review your application in the admin portal and get back to you.</p>
              </div>
            ) : selected === null ? (
              <div className="grid gap-6 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSelected("provider")}
                  className="card-glass p-6 text-left hover:border-accent/50 transition border-2 border-transparent rounded-xl"
                >
                  <h2 className="text-xl font-semibold mb-2">Delivery Provider Listing</h2>
                  <p className="text-muted text-sm mb-4">
                    You negotiate pricing directly with vendors. Good Hemp Distro functions as a
                    discovery & directory platform.
                  </p>
                  <span className="text-accent font-medium">Continue →</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelected("driver")}
                  className="card-glass p-6 text-left hover:border-accent/50 transition border-2 border-transparent rounded-xl"
                >
                  <h2 className="text-xl font-semibold mb-2">On-Demand Driver Network</h2>
                  <p className="text-muted text-sm mb-4">
                    Good Hemp Distro sets delivery pricing. You&apos;re paid per delivery + keep
                    100% of tips.
                  </p>
                  <span className="text-accent font-medium">Apply as On-Demand Driver →</span>
                </button>
              </div>
            ) : selected === "provider" ? (
              <div className="card-glass p-6">
                <h2 className="text-xl font-semibold mb-2">Delivery Provider Listing</h2>
                <p className="text-muted text-sm mb-4">
                  You negotiate pricing directly with vendors. Good Hemp Distro functions as a
                  discovery & directory platform.
                </p>
                <div className="flex gap-3">
                  <Link href="/pricing?tab=vendor" className="btn-primary">
                    Continue to Vendor Pricing
                  </Link>
                  <button type="button" onClick={() => setSelected(null)} className="btn-secondary">
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <div className="card-glass p-6">
                <h2 className="text-xl font-semibold mb-4">Apply as On-Demand Driver</h2>
                <form onSubmit={handleDriverSubmit} className="space-y-4">
                  {error && (
                    <div className="bg-red-900/30 border border-red-600 rounded-lg p-3 text-red-400 text-sm">
                      {error}
                    </div>
                  )}
                  <div>
                    <label htmlFor="full_name" className="block text-sm font-medium mb-1">Full name <span className="text-red-400">*</span></label>
                    <input
                      id="full_name"
                      type="text"
                      required
                      value={driverForm.full_name}
                      onChange={(e) => setDriverForm((p) => ({ ...p, full_name: e.target.value }))}
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-1">Email <span className="text-red-400">*</span></label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={driverForm.email}
                      onChange={(e) => setDriverForm((p) => ({ ...p, email: e.target.value }))}
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium mb-1">Phone</label>
                    <input
                      id="phone"
                      type="tel"
                      value={driverForm.phone}
                      onChange={(e) => setDriverForm((p) => ({ ...p, phone: e.target.value }))}
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="service_area" className="block text-sm font-medium mb-1">Service area</label>
                    <input
                      id="service_area"
                      type="text"
                      placeholder="e.g. Denver metro"
                      value={driverForm.service_area}
                      onChange={(e) => setDriverForm((p) => ({ ...p, service_area: e.target.value }))}
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="vehicle_type" className="block text-sm font-medium mb-1">Vehicle type</label>
                    <input
                      id="vehicle_type"
                      type="text"
                      placeholder="e.g. Sedan, SUV"
                      value={driverForm.vehicle_type}
                      onChange={(e) => setDriverForm((p) => ({ ...p, vehicle_type: e.target.value }))}
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="notes" className="block text-sm font-medium mb-1">Notes</label>
                    <textarea
                      id="notes"
                      rows={3}
                      value={driverForm.notes}
                      onChange={(e) => setDriverForm((p) => ({ ...p, notes: e.target.value }))}
                      className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-white"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
                      {submitting ? "Submitting..." : "Submit Application"}
                    </button>
                    <button type="button" onClick={() => setSelected(null)} className="btn-secondary">
                      Back
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
