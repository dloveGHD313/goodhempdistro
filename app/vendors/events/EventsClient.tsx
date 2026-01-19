"use client";

import Link from "next/link";
import { useState } from "react";

type Event = {
  id: string;
  title: string;
  start_time: string;
  status: string;
  capacity: number | null;
  tickets_sold: number;
  created_at: string;
};

type Props = {
  initialEvents: Event[];
};

export default function EventsClient({ initialEvents }: Props) {
  const [events] = useState<Event[]>(initialEvents);

  if (events.length === 0) {
    return (
      <div className="card-glass p-8 text-center">
        <p className="text-muted mb-4">No events created yet.</p>
        <Link href="/vendors/events/new" className="btn-primary">
          Create Your First Event
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const soldOut = event.capacity !== null && event.tickets_sold >= event.capacity;
        const remaining = event.capacity !== null ? event.capacity - event.tickets_sold : null;

        return (
          <div key={event.id} className="card-glass p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2">{event.title}</h3>
                <p className="text-muted mb-2">
                  {new Date(event.start_time).toLocaleString()}
                </p>
                <div className="flex gap-4 text-sm">
                  <span className="text-muted">
                    Sold: {event.tickets_sold} / {event.capacity === null ? "∞" : event.capacity}
                  </span>
                  {remaining !== null && (
                    <span className={soldOut ? "text-red-400" : "text-green-400"}>
                      {soldOut ? "Sold Out" : `${remaining} remaining`}
                    </span>
                  )}
                  <span className={`px-2 py-1 rounded text-xs ${
                    event.status === "published"
                      ? "bg-green-500/20 text-green-400"
                      : event.status === "cancelled"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {event.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <Link href={`/vendors/events/${event.id}/edit`} className="btn-secondary">
                Edit
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
