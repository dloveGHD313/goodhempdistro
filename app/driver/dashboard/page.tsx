"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Footer from "@/components/Footer";
import DriverConnectCard from "./DriverConnectCard";

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
  confirmed_at?: string | null;
  proof_photo_url?: string | null;
  payout_status?: "unpaid" | "eligible" | "paid" | "failed";
  driver_payout_cents?: number;
  driver_stripe_transfer_id?: string | null;
};

type ConfirmFormState = {
  open: boolean;
  deliveryType: "retail" | "b2b";
  proofPhotoUrl: string;
  receiverName: string;
  bolReference: string;
  submitting: boolean;
  message: string | null;
};

function initialConfirmState(): ConfirmFormState {
  return {
    open: false,
    deliveryType: "retail",
    proofPhotoUrl: "",
    receiverName: "",
    bolReference: "",
    submitting: false,
    message: null,
  };
}

export default function DriverDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<DriverStatus | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmForms, setConfirmForms] = useState<Record<string, ConfirmFormState>>({});

  const loadData = useCallback(async () => {
    try {
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

      if (statusData.driver?.status === "approved") {
        const deliveriesRes = await fetch("/api/deliveries/my", { cache: "no-store" });
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
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleConfirmForm = (deliveryId: string) => {
    setConfirmForms((prev) => ({
      ...prev,
      [deliveryId]: {
        ...(prev[deliveryId] ?? initialConfirmState()),
        open: !(prev[deliveryId]?.open ?? false),
        message: null,
      },
    }));
  };

  const updateConfirmForm = (deliveryId: string, patch: Partial<ConfirmFormState>) => {
    setConfirmForms((prev) => ({
      ...prev,
      [deliveryId]: {
        ...(prev[deliveryId] ?? initialConfirmState()),
        ...patch,
      },
    }));
  };

  const handleConfirmDelivery = async (deliveryId: string) => {
    const state = confirmForms[deliveryId] ?? initialConfirmState();

    updateConfirmForm(deliveryId, { submitting: true, message: null });

    try {
      const response = await fetch(`/api/driver/deliveries/${deliveryId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_type: state.deliveryType,
          proof_photo_url: state.proofPhotoUrl,
          receiver_name: state.deliveryType === "b2b" ? state.receiverName : undefined,
          bol_reference: state.bolReference || undefined,
        }),
      });

      const data = await response.json().catch(() => null);
      const reference = response.headers.get("X-Request-Id") ?? data?.requestId ?? "unknown";

      if (!response.ok) {
        updateConfirmForm(deliveryId, {
          submitting: false,
          message: `Confirmation failed. Reference: ${reference}`,
        });
        return;
      }

      const statusText = String(data?.payout_status ?? "unpaid").toUpperCase();
      const transferText = data?.stripe_transfer_id ? ` • Transfer: ${data.stripe_transfer_id}` : "";

      updateConfirmForm(deliveryId, {
        submitting: false,
        open: false,
        message: `Saved. Payout status: ${statusText}${transferText}`,
      });

      const detailRes = await fetch(`/api/driver/deliveries/${deliveryId}`, { cache: "no-store" });
      const detailData = await detailRes.json().catch(() => null);

      if (detailRes.ok && detailData?.delivery) {
        setDeliveries((prev) =>
          prev.map((delivery) =>
            delivery.id === deliveryId
              ? {
                  ...delivery,
                  payout_status: detailData.delivery.payout_status,
                  driver_stripe_transfer_id: detailData.delivery.driver_stripe_transfer_id,
                  confirmed_at: detailData.delivery.confirmed_at,
                  proof_photo_url: detailData.delivery.proof_photo_url,
                  driver_payout_cents: detailData.delivery.driver_payout_cents,
                }
              : delivery
          )
        );
      }
    } catch {
      updateConfirmForm(deliveryId, {
        submitting: false,
        message: "Confirmation failed. Reference: unknown",
      });
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

  if (error) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <Link href="/driver/dashboard" className="btn-secondary">
                Retry
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  const applicationStatus = status?.application?.status || "none";
  const isApproved = status?.driver?.status === "approved";

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
                Your application is being reviewed. You&apos;ll be notified once a decision is made.
              </p>
            </div>
          )}

          {applicationStatus === "rejected" && (
            <div className="card-glass p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4 text-red-400">Application Rejected</h2>
              <p className="text-muted mb-4">
                Your application was not approved. If you believe this is an error, please contact support.
              </p>
              <Link href="/logistics/apply" className="btn-secondary">
                Reapply
              </Link>
            </div>
          )}

          {applicationStatus === "none" && (
            <div className="card-glass p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4">No Application Found</h2>
              <p className="text-muted mb-4">You haven&apos;t submitted a driver application yet.</p>
              <Link href="/logistics/apply" className="btn-primary">
                Apply Now
              </Link>
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

              <DriverConnectCard />

              <div className="card-glass p-6 mb-8">
                <h2 className="text-2xl font-bold mb-3">Delivery Confirmation &amp; Proof</h2>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted">
                  <li>Retail: proof photo URL is required.</li>
                  <li>B2B: proof photo URL and receiver name are required. BOL reference is optional.</li>
                  <li>After verification, payout release is attempted automatically.</li>
                </ul>
                {deliveries.length === 0 && (
                  <p className="text-sm text-muted mt-3">
                    Confirmation actions appear per-delivery in the table once deliveries are assigned.
                  </p>
                )}
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
                          <th className="pb-3 font-semibold text-muted">Confirmed</th>
                          <th className="pb-3 font-semibold text-muted">Proof</th>
                          <th className="pb-3 font-semibold text-muted">Payout</th>
                          <th className="pb-3 font-semibold text-muted">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveries.map((delivery) => {
                          const formState = confirmForms[delivery.id] ?? initialConfirmState();
                          const canConfirm = delivery.status === "delivered";

                          return (
                            <tr key={delivery.id} className="border-b border-[var(--border)]/60 align-top">
                              <td className="py-3 text-muted">{new Date(delivery.created_at).toLocaleDateString()}</td>
                              <td className="py-3 text-muted">{delivery.pickup_name}</td>
                              <td className="py-3 text-muted">{delivery.dropoff_name}</td>
                              <td className="py-3 text-muted">
                                {delivery.distance_miles ? `${delivery.distance_miles.toFixed(1)} mi` : "N/A"}
                              </td>
                              <td className="py-3 font-semibold">${(delivery.payout_cents / 100).toFixed(2)}</td>
                              <td className="py-3">
                                <div className="flex flex-col gap-2">
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-semibold w-fit ${
                                      delivery.status === "delivered"
                                        ? "bg-green-500/20 text-green-400"
                                        : delivery.status === "assigned"
                                        ? "bg-blue-500/20 text-blue-400"
                                        : "bg-orange-500/20 text-orange-400"
                                    }`}
                                  >
                                    {delivery.status.toUpperCase()}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 text-sm text-muted">
                                {delivery.confirmed_at ? "Yes" : "No"}
                                <div className="text-xs text-muted/80 mt-1">
                                  {delivery.confirmed_at
                                    ? new Date(delivery.confirmed_at).toLocaleString()
                                    : "Not confirmed"}
                                </div>
                              </td>
                              <td className="py-3 text-sm text-muted">
                                {delivery.proof_photo_url ? "Uploaded" : "Missing"}
                              </td>
                              <td className="py-3 text-sm text-muted">
                                {(delivery.payout_status ?? "unpaid").toUpperCase()}
                              </td>
                              <td className="py-3">
                                <div className="space-y-2">
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => toggleConfirmForm(delivery.id)}
                                    disabled={!canConfirm}
                                    title={
                                      canConfirm
                                        ? "Submit confirmation proof"
                                        : "You can confirm after you mark delivered."
                                    }
                                  >
                                    Confirm Delivery
                                  </button>

                                  {!canConfirm && (
                                    <p className="text-xs text-muted">You can confirm after you mark delivered.</p>
                                  )}

                                  {formState.message && (
                                    <p className="text-xs text-muted max-w-72">{formState.message}</p>
                                  )}

                                  {formState.open && (
                                    <div className="card-glass p-3 space-y-2 min-w-72">
                                      <label className="block text-xs text-muted">
                                        Proof photo URL
                                        <input
                                          value={formState.proofPhotoUrl}
                                          onChange={(e) =>
                                            updateConfirmForm(delivery.id, { proofPhotoUrl: e.target.value })
                                          }
                                          className="mt-1 w-full rounded border border-[var(--border)] bg-black/20 px-2 py-1 text-sm"
                                        />
                                      </label>

                                      <label className="block text-xs text-muted">
                                        Delivery type
                                        <select
                                          value={formState.deliveryType}
                                          onChange={(e) =>
                                            updateConfirmForm(delivery.id, {
                                              deliveryType: e.target.value === "b2b" ? "b2b" : "retail",
                                            })
                                          }
                                          className="mt-1 w-full rounded border border-[var(--border)] bg-black/20 px-2 py-1 text-sm"
                                        >
                                          <option value="retail">retail</option>
                                          <option value="b2b">b2b</option>
                                        </select>
                                      </label>

                                      {formState.deliveryType === "b2b" && (
                                        <label className="block text-xs text-muted">
                                          Receiver name
                                          <input
                                            value={formState.receiverName}
                                            onChange={(e) =>
                                              updateConfirmForm(delivery.id, { receiverName: e.target.value })
                                            }
                                            className="mt-1 w-full rounded border border-[var(--border)] bg-black/20 px-2 py-1 text-sm"
                                          />
                                        </label>
                                      )}

                                      <label className="block text-xs text-muted">
                                        BOL reference (optional)
                                        <input
                                          value={formState.bolReference}
                                          onChange={(e) =>
                                            updateConfirmForm(delivery.id, { bolReference: e.target.value })
                                          }
                                          className="mt-1 w-full rounded border border-[var(--border)] bg-black/20 px-2 py-1 text-sm"
                                        />
                                      </label>

                                      <button
                                        type="button"
                                        onClick={() => handleConfirmDelivery(delivery.id)}
                                        disabled={formState.submitting}
                                        className="btn-primary disabled:opacity-50"
                                      >
                                        {formState.submitting ? "Saving..." : "Submit Confirmation"}
                                      </button>

                                      {delivery.driver_stripe_transfer_id && (
                                        <p className="text-xs text-green-400">
                                          Paid • {delivery.driver_stripe_transfer_id}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
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
