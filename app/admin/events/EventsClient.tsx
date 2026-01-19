"use client";

import { useState } from "react";
import Link from "next/link";

type Event = {
  id: string;
  title: string;
  start_time: string;
  status: string;
  capacity: number | null;
  tickets_sold: number;
  created_at: string;
  vendors: {
    business_name: string;
  } | null;
};

type Props = {
  initialEvents: Event[];
};

export default function EventsClient({ initialEvents }: Props) {
  const [events, setEvents] = useState<Event[]>(initialEvents);

  const updateEventStatus = async (id: string, status: "cancelled" | "published" | "draft") => {
    try {
      const response = await fetch(`/api/admin/events/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to update event status");
        return;
      }

      setEvents(events.map((e) => (e.id === id ? { ...e, status } : e)));
    } catch (error) {
      alert("Failed to update event status");
    }
  };

  if (events.length === 0) {
    return (
      <div className="card-glass p-8 text-center">
        <p className="text-muted">No events found.</p>
      </div>
    );
  }

  return (
    <div className="card-glass p-6">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-[var(--border)]">
            <tr>
              <th className="pb-3 font-semibold text-muted">Event</th>
              <th className="pb-3 font-semibold text-muted">Vendor</th>
              <th className="pb-3 font-semibold text-muted">Date</th>
              <th className="pb-3 font-semibold text-muted">Sales</th>
              <th className="pb-3 font-semibold text-muted">Status</th>
              <th className="pb-3 font-semibold text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const soldOut = event.capacity !== null && event.tickets_sold >= event.capacity;
              const revenue = 0; // TODO: Calculate from orders

              return (
                <tr key={event.id} className="border-b border-[var(--border)]/60">
                  <td className="py-3 font-semibold">{event.title}</td>
                  <td className="py-3 text-muted">{event.vendors?.business_name || "N/A"}</td>
                  <td className="py-3 text-muted">
                    {new Date(event.start_time).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-muted">
                    {event.tickets_sold} / {event.capacity === null ? "∞" : event.capacity}
                    {soldOut && <span className="text-red-400 ml-2">(Sold Out)</span>}
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      event.status === "published"
                        ? "bg-green-500/20 text-green-400"
                        : event.status === "cancelled"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-yellow-500/20 text-yellow-400"
                    }`}>
                      {event.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3">
                    {event.status !== "cancelled" && (
                      <button
                        onClick={() => updateEventStatus(event.id, "cancelled")}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                      >
                        Cancel
                      </button>
                    )}
                    {event.status === "cancelled" && (
                      <button
                        onClick={() => updateEventStatus(event.id, "published")}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                      >
                        Publish
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
