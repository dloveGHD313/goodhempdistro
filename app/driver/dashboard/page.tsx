"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Footer from "@/components/Footer";

type DriverStatus = {
  application: {
    id: string;
    status: string;
    created_at: string;
  } | null;
  driver: {
    id: string;
    status: string;
    created_at: string;
  } | null;
};

type Delivery = {
  id: string;
  pickup_name: string;
  pickup_address: string;
  dropoff_name: string;
  dropoff_address: string;
  distance_miles: number | null;
  payout_cents: number;
  status: string;
  created_at: string;
};

export default function DriverDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DriverStatus | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Get driver status
        const statusRes = await fetch("/api/driver/me");
        if (!statusRes.ok) {
          if (statusRes.status === 401) {
            router.push("/login?redirect=/driver/dashboard");
            return;
          }
          throw new Error("Failed to load driver status");
        }
        const statusData = await statusRes.json();
        setStatus(statusData);

        // If approved, load deliveries
        if (statusData.driver?.status === "approved") {
          const deliveriesRes = await fetch("/api/deliveries/my");
          if (deliveriesRes.ok) {
            const deliveriesData = await deliveriesRes.json();
            setDeliveries(deliveriesData.deliveries || []);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

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

  if (error) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <Link href="/driver/dashboard" className="btn-secondary">Retry</Link>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  const applicationStatus = status?.application?.status || "none";
  const isApproved = status?.driver?.status === "approved";

  // Calculate totals
  const totalPayout = deliveries
    .filter((d) => d.status === "delivered")
    .reduce((sum, d) => sum + d.payout_cents, 0);
  const completedCount = deliveries.filter((d) => d.status === "delivered").length;

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <h1 className="text-4xl font-bold mb-8 text-accent">Driver Dashboard</h1>

          {applicationStatus === "pending" && (
            <div className="card-glass p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4">Application Pending</h2>
              <p className="text-muted mb-4">
                Your application is being reviewed. You'll be notified once a decision is made.
              </p>
            </div>
          )}

          {applicationStatus === "rejected" && (
            <div className="card-glass p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4 text-red-400">Application Rejected</h2>
              <p className="text-muted mb-4">
                Your application was not approved. If you believe this is an error, please contact support.
              </p>
              <Link href="/driver-apply" className="btn-secondary">Reapply</Link>
            </div>
          )}

          {applicationStatus === "none" && (
            <div className="card-glass p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4">No Application Found</h2>
              <p className="text-muted mb-4">You haven't submitted a driver application yet.</p>
              <Link href="/driver-apply" className="btn-primary">Apply Now</Link>
            </div>
          )}

          {isApproved && (
            <>
              <div className="grid gap-6 md:grid-cols-3 mb-8">
                <div className="card-glass p-6">
                  <h3 className="text-lg text-muted mb-2">Total Deliveries</h3>
                  <p className="text-4xl font-bold">{deliveries.length}</p>
                </div>
                <div className="card-glass p-6">
                  <h3 className="text-lg text-muted mb-2">Completed</h3>
                  <p className="text-4xl font-bold text-green-400">{completedCount}</p>
                </div>
                <div className="card-glass p-6">
                  <h3 className="text-lg text-muted mb-2">Total Earnings</h3>
                  <p className="text-4xl font-bold text-accent">${(totalPayout / 100).toFixed(2)}</p>
                </div>
              </div>

              <div className="mb-6">
                <button
                  disabled
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Cash out feature coming soon"
                >
                  Cash Out (Coming Soon)
                </button>
              </div>

              <div className="card-glass p-6">
                <h2 className="text-2xl font-bold mb-4">My Deliveries</h2>
                {deliveries.length === 0 ? (
                  <p className="text-muted">No deliveries assigned yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="border-b border-[var(--border)]">
                        <tr>
                          <th className="pb-3 font-semibold text-muted">Date</th>
                          <th className="pb-3 font-semibold text-muted">Pickup</th>
                          <th className="pb-3 font-semibold text-muted">Dropoff</th>
                          <th className="pb-3 font-semibold text-muted">Distance</th>
                          <th className="pb-3 font-semibold text-muted">Payout</th>
                          <th className="pb-3 font-semibold text-muted">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveries.map((delivery) => (
                          <tr key={delivery.id} className="border-b border-[var(--border)]/60">
                            <td className="py-3 text-muted">
                              {new Date(delivery.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3 text-muted">{delivery.pickup_name}</td>
                            <td className="py-3 text-muted">{delivery.dropoff_name}</td>
                            <td className="py-3 text-muted">
                              {delivery.distance_miles ? `${delivery.distance_miles.toFixed(1)} mi` : "N/A"}
                            </td>
                            <td className="py-3 font-semibold">${(delivery.payout_cents / 100).toFixed(2)}</td>
                            <td className="py-3">
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold ${
                                  delivery.status === "delivered"
                                    ? "bg-green-500/20 text-green-400"
                                    : delivery.status === "assigned"
                                    ? "bg-blue-500/20 text-blue-400"
                                    : "bg-orange-500/20 text-orange-400"
                                }`}
                              >
                                {delivery.status.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
