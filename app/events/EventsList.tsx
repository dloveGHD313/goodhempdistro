"use client";

import Link from "next/link";
import { useState } from "react";

type Event = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  capacity: number | null;
  tickets_sold: number;
  vendors: {
    business_name: string;
  } | null;
};

type Props = {
  initialEvents: Event[];
};

export default function EventsList({ initialEvents }: Props) {
  const [events] = useState<Event[]>(initialEvents);

  if (events.length === 0) {
    return (
      <div className="text-center py-16 card-glass p-8">
        <p className="text-muted text-lg mb-2">No upcoming events at the moment.</p>
        <p className="text-muted">Check back soon for new events!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {events.map((event) => {
        const soldOut = event.capacity !== null && event.tickets_sold >= event.capacity;
        const remaining = event.capacity !== null ? event.capacity - event.tickets_sold : null;

        return (
          <Link key={event.id} href={`/events/${event.id}`} className="group">
            <div className="card-glass p-6 hover-lift h-full cursor-pointer">
              <div className="aspect-square bg-[var(--surface)]/60 rounded-lg mb-4 group-hover:bg-[var(--surface)]/80 transition flex items-center justify-center">
                <span className="text-4xl">🎉</span>
              </div>
              <h3 className="text-xl font-semibold mb-2 group-hover:text-accent transition">
                {event.title}
              </h3>
              {event.vendors && (
                <p className="text-muted mb-2 text-sm">By {event.vendors.business_name}</p>
              )}
              <p className="text-muted mb-2 text-sm">
                {new Date(event.start_time).toLocaleDateString()} at {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              {event.location && (
                <p className="text-muted mb-4 text-sm">📍 {event.location}</p>
              )}
              <div className="flex justify-between items-center">
                {soldOut ? (
                  <span className="text-red-400 font-semibold">Sold Out</span>
                ) : (
                  <span className="text-green-400 font-semibold">
                    {remaining !== null ? `${remaining} tickets remaining` : "Tickets Available"}
                  </span>
                )}
                <button className="btn-secondary px-4 py-2 rounded-lg">View</button>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
