"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import Footer from "@/components/Footer";

export default function LogisticsRequestPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [distanceMiles, setDistanceMiles] = useState("");
  const [stops, setStops] = useState("1");

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      router.push("/login?redirect=/logistics/request");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/deliveries/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup_name: businessName || "Pickup Location",
          pickup_address: pickupAddress,
          dropoff_name: businessName || "Dropoff Location",
          dropoff_address: dropoffAddress,
          distance_miles: parseFloat(distanceMiles) || 0,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create delivery request");
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <p className="text-muted">Loading...</p>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-4xl font-bold mb-2 text-accent">Request a Delivery</h1>
            <p className="text-muted mb-8">
              Submit a delivery request for your business. We&apos;ll connect you with local drivers.
            </p>

            {!user && (
              <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 mb-6">
                <p className="text-yellow-400 mb-4">
                  You must be logged in and have a vendor account to request deliveries.
                </p>
                <Link href="/login?redirect=/logistics/request" className="btn-secondary">
                  Login
                </Link>
              </div>
            )}

            {success && (
              <div className="bg-green-900/30 border border-green-600 rounded-lg p-4 mb-6 text-green-400">
                <p>Delivery request submitted successfully!</p>
              </div>
            )}

            {error && (
              <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 mb-6 text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmitRequest} className="space-y-6 card-glass p-8">
              <div>
                <label htmlFor="business_name" className="block text-sm font-medium mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  id="business_name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                />
              </div>

              <div>
                <label htmlFor="pickup_address" className="block text-sm font-medium mb-2">
                  Pickup Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="pickup_address"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                />
              </div>

              <div>
                <label htmlFor="dropoff_address" className="block text-sm font-medium mb-2">
                  Dropoff Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  id="dropoff_address"
                  value={dropoffAddress}
                  onChange={(e) => setDropoffAddress(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="distance_miles" className="block text-sm font-medium mb-2">
                    Estimated Distance (miles)
                  </label>
                  <input
                    type="number"
                    id="distance_miles"
                    value={distanceMiles}
                    onChange={(e) => setDistanceMiles(e.target.value)}
                    min="0"
                    step="0.1"
                    className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                  />
                </div>
                <div>
                  <label htmlFor="stops" className="block text-sm font-medium mb-2">
                    Number of Stops
                  </label>
                  <input
                    type="number"
                    id="stops"
                    value={stops}
                    onChange={(e) => setStops(e.target.value)}
                    min="1"
                    className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="contact_phone" className="block text-sm font-medium mb-2">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  id="contact_phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                />
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={submitting || !user}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
                <Link href="/logistics" className="btn-secondary">
                  Back to Logistics
                </Link>
              </div>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
