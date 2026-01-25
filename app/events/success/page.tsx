"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Footer from "@/components/Footer";

type Confirmation = {
  orderId?: string | null;
  eventId?: string | null;
  status?: string | null;
};

export default function EventSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  useEffect(() => {
    const confirmOrder = async () => {
      if (!sessionId) {
        setError("Missing checkout session.");
        setLoading(false);
        return;
      }
      try {
        const response = await fetch("/api/events/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data?.error || "Unable to confirm your tickets.");
          setLoading(false);
          return;
        }
        setConfirmation({
          orderId: data.orderId,
          eventId: data.eventId,
          status: data.status,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to confirm your tickets.");
      } finally {
        setLoading(false);
      }
    };

    confirmOrder();
  }, [sessionId]);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-2xl mx-auto text-center card-glass p-8">
            <h1 className="text-4xl font-bold mb-4 text-green-400">🎉 Tickets Purchased!</h1>
            {loading ? (
              <p className="text-muted mb-6">Confirming your ticket order...</p>
            ) : error ? (
              <p className="text-red-400 mb-6">{error}</p>
            ) : (
              <div className="text-muted mb-6 space-y-2">
                <p>Your tickets have been successfully purchased.</p>
                {confirmation?.orderId && (
                  <p className="text-xs text-muted">Order: {confirmation.orderId}</p>
                )}
                {confirmation?.status && (
                  <p className="text-xs text-muted">Status: {confirmation.status}</p>
                )}
              </div>
            )}
            <div className="flex gap-4 justify-center">
              <Link href="/events" className="btn-primary">
                Browse More Events
              </Link>
              <Link href="/dashboard" className="btn-secondary">
                Go to Dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
