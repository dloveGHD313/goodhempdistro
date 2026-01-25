"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Footer from "@/components/Footer";
import type { EventWithTicketTypes, TicketPurchase } from "@/lib/events.types";
import FavoriteButton from "@/components/engagement/FavoriteButton";
import ReviewSection from "@/components/engagement/ReviewSection";
import EventEngagementButtons from "@/components/engagement/EventEngagementButtons";

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [event, setEvent] = useState<EventWithTicketTypes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticketQuantities, setTicketQuantities] = useState<Record<string, number>>({});
  const [checkingOut, setCheckingOut] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [rsvpMessage, setRsvpMessage] = useState<string | null>(null);

  useEffect(() => {
    loadEvent();
  }, [params.id]);

  const loadEvent = async () => {
    try {
      const response = await fetch(`/api/events/${params.id}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to load event");
        setLoading(false);
        return;
      }

      setEvent(data.event);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load event");
      setLoading(false);
    }
  };

  const updateQuantity = (ticketTypeId: string, quantity: number) => {
    if (quantity < 0) return;
    setTicketQuantities({ ...ticketQuantities, [ticketTypeId]: quantity });
  };

  const handleCheckout = async () => {
    const purchases: TicketPurchase[] = Object.entries(ticketQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([ticketTypeId, quantity]) => ({
        ticket_type_id: ticketTypeId,
        quantity,
      }));

    if (purchases.length === 0) {
      setError("Please select at least one ticket");
      return;
    }

    setCheckingOut(true);
    setError(null);

    try {
      const response = await fetch("/api/events/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: params.id,
          tickets: purchases,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create checkout session");
        setCheckingOut(false);
        return;
      }

      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Invalid checkout URL");
        setCheckingOut(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setCheckingOut(false);
    }
  };

  const handleRsvp = async () => {
    setRsvpLoading(true);
    setError(null);
    setRsvpMessage(null);
    try {
      const response = await fetch("/api/events/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: params.id }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Unable to RSVP for this event.");
        setRsvpLoading(false);
        return;
      }
      setRsvpMessage(data.message || "RSVP confirmed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to RSVP for this event.");
    } finally {
      setRsvpLoading(false);
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

  if (error || !event) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <p className="text-red-400">{error || "Event not found"}</p>
            <Link href="/events" className="btn-secondary mt-4">
              Back to Events
            </Link>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  const soldOut = event.capacity !== null && event.tickets_sold >= event.capacity;
  const totalSelected = Object.values(ticketQuantities).reduce((sum, qty) => sum + qty, 0);
  const totalCents = event.event_ticket_types.reduce((sum, tt) => {
    const qty = ticketQuantities[tt.id] || 0;
    return sum + tt.price_cents * qty;
  }, 0);
  const isFreeEvent =
    event.event_ticket_types.length === 0 ||
    event.event_ticket_types.every((tt) => tt.price_cents === 0);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <Link href="/events" className="text-accent hover:underline mb-8 inline-block">
            ← Back to Events
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-8">
            <div>
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-4xl font-bold mb-4 text-accent">{event.title}</h1>
                <FavoriteButton entityType="event" entityId={event.id} size="md" />
              </div>
              {event.description && (
                <div className="text-muted mb-4 whitespace-pre-wrap">{event.description}</div>
              )}
              <div className="space-y-2 mb-6">
                <p className="text-muted">
                  📅 {new Date(event.start_time).toLocaleString()} - {new Date(event.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                {event.location && <p className="text-muted">📍 {event.location}</p>}
                {event.vendors && <p className="text-muted">By {event.vendors.business_name}</p>}
              </div>
              {soldOut && (
                <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400 mb-6">
                  This event is sold out.
                </div>
              )}
              <EventEngagementButtons eventId={event.id} />
            </div>

            <div className="card-glass p-6">
              <h2 className="text-2xl font-bold mb-4">Ticket Options</h2>

              {isFreeEvent ? (
                <div className="space-y-4">
                  <p className="text-muted">
                    This event is free to attend. Reserve your spot to receive updates.
                  </p>
                  {rsvpMessage && (
                    <div className="bg-green-900/30 border border-green-600 rounded-lg p-4 text-green-300">
                      {rsvpMessage}
                    </div>
                  )}
                  <button
                    onClick={handleRsvp}
                    disabled={soldOut || rsvpLoading}
                    className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {soldOut ? "Sold Out" : rsvpLoading ? "Saving RSVP..." : "RSVP for Free"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4 mb-6">
                  {event.event_ticket_types.map((tt) => {
                    const available = tt.quantity === null ? true : (tt.quantity - tt.sold > 0);
                    const remaining = tt.quantity === null ? null : tt.quantity - tt.sold;
                    const qty = ticketQuantities[tt.id] || 0;

                    return (
                      <div key={tt.id} className="border border-[var(--border)] rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold">{tt.name}</h3>
                            <p className="text-2xl font-bold text-accent mt-1">
                              ${(tt.price_cents / 100).toFixed(2)}
                            </p>
                          </div>
                          {available && !soldOut && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateQuantity(tt.id, qty - 1)}
                                disabled={qty === 0}
                                className="w-8 h-8 rounded bg-[var(--surface)] border border-[var(--border)] disabled:opacity-50"
                              >
                                -
                              </button>
                              <span className="w-8 text-center">{qty}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(tt.id, qty + 1)}
                                disabled={!available || (remaining !== null && qty >= remaining)}
                                className="w-8 h-8 rounded bg-[var(--surface)] border border-[var(--border)] disabled:opacity-50"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                        {remaining !== null && (
                          <p className="text-sm text-muted">{remaining} remaining</p>
                        )}
                        {!available && <p className="text-sm text-red-400">Sold out</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {totalSelected > 0 && (
                <div className="border-t border-[var(--border)] pt-4 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">Total ({totalSelected} {totalSelected === 1 ? 'ticket' : 'tickets'}):</span>
                    <span className="text-2xl font-bold text-accent">
                      ${(totalCents / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400 mb-4">
                  {error}
                </div>
              )}

              {!isFreeEvent && (
                <button
                  onClick={handleCheckout}
                  disabled={totalSelected === 0 || soldOut || checkingOut}
                  className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {checkingOut ? "Processing..." : soldOut ? "Sold Out" : totalSelected === 0 ? "Select Tickets" : "Buy Tickets"}
                </button>
              )}
            </div>
          </div>
          <div className="mt-12">
            <ReviewSection entityType="event" entityId={event.id} title="Event Reviews" />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
