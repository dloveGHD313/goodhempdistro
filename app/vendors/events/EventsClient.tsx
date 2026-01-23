"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Event = {
  id: string;
  title: string;
  start_time: string;
  status: "draft" | "pending_review" | "approved" | "rejected" | "published" | "cancelled";
  capacity: number | null;
  tickets_sold: number;
  created_at: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
};

type Props = {
  initialEvents: Event[];
};

export default function EventsClient({ initialEvents }: Props) {
  const router = useRouter();
  const [events] = useState<Event[]>(initialEvents);
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubmit = async (eventId: string) => {
    setLoading(eventId);
    try {
      const response = await fetch(`/api/vendors/events/${eventId}/submit`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to submit event");
        setLoading(null);
        return;
      }

      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(null);
    }
  };

  const getStatusBadge = (status: Event["status"]) => {
    const classes = {
      draft: "bg-gray-600 text-gray-200",
      pending_review: "bg-yellow-600 text-yellow-100",
      approved: "bg-green-600 text-green-100",
      rejected: "bg-red-600 text-red-100",
      published: "bg-green-700 text-green-200",
      cancelled: "bg-red-700 text-red-200",
    };

    const labels = {
      draft: "Draft",
      pending_review: "Pending Review",
      approved: "Approved",
      rejected: "Rejected",
      published: "Published",
      cancelled: "Cancelled",
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${classes[status]}`}>
        {labels[status]}
      </span>
    );
  };

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
                  {getStatusBadge(event.status)}
                </div>
                <div className="text-sm text-muted mt-2 space-y-1">
                  {event.submitted_at && (
                    <div>Submitted: {new Date(event.submitted_at).toLocaleDateString()}</div>
                  )}
                  {event.reviewed_at && (
                    <div>Reviewed: {new Date(event.reviewed_at).toLocaleDateString()}</div>
                  )}
                </div>
                {event.status === "rejected" && event.rejection_reason && (
                  <div className="mt-3 p-3 bg-red-900/30 border border-red-600 rounded">
                    <p className="text-red-400 text-sm">
                      <strong>Rejection Reason:</strong> {event.rejection_reason}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {(event.status === "draft" || event.status === "rejected") && (
                  <button
                    onClick={() => handleSubmit(event.id)}
                    disabled={loading === event.id}
                    className="btn-primary disabled:opacity-50"
                  >
                    {loading === event.id ? "Submitting..." : "Submit for Review"}
                  </button>
                )}
                <Link href={`/vendors/events/${event.id}/edit`} className="btn-secondary">
                  Edit
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
