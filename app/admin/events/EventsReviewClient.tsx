"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EventItem = {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start_time: string;
  end_time: string;
  status: string;
  submitted_at: string;
  vendor_id: string | null;
  owner_user_id: string | null;
  vendor_name?: string | null;
  vendor_email?: string | null;
};

type Props = {
  initialEvents: EventItem[];
  initialCounts: {
    total: number;
    pending: number;
    approved: number;
    draft: number;
    rejected: number;
  };
  initialStatus: string;
};

const STATUS_TABS = [
  { id: "pending_review", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "draft", label: "Draft" },
];

export default function EventsReviewClient({ initialEvents, initialCounts, initialStatus }: Props) {
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>(initialEvents);
  const [counts, setCounts] = useState(initialCounts);
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState(initialStatus);
  const [listError, setListError] = useState<string | null>(null);

  const fetchList = async (status: string) => {
    setListError(null);
    const response = await fetch(`/api/admin/events?status=${status}&limit=50`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setListError(data?.error || "Failed to load events");
      return;
    }
    setEvents(data.data || []);
    setCounts(
      data.counts || { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 }
    );
  };

  const handleApprove = async (eventId: string) => {
    setLoading(eventId);
    try {
      const response = await fetch(`/api/admin/events/${eventId}/approve`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        alert(data.error || "Failed to approve event");
        setLoading(null);
        return;
      }

      setEvents(events.filter((e) => e.id !== eventId));
      setCounts({
        ...counts,
        pending: counts.pending - 1,
        approved: counts.approved + 1,
      });

      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(null);
    }
  };

  const handleReject = async (eventId: string) => {
    const reason = rejectionReason[eventId]?.trim();
    if (!reason) {
      alert("Rejection reason is required");
      return;
    }

    setLoading(eventId);
    try {
      const response = await fetch(`/api/admin/events/${eventId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        alert(data.error || "Failed to reject event");
        setLoading(null);
        return;
      }

      setEvents(events.filter((e) => e.id !== eventId));
      setCounts({
        ...counts,
        pending: counts.pending - 1,
        rejected: counts.rejected + 1,
      });
      setShowRejectForm(null);
      setRejectionReason({ ...rejectionReason, [eventId]: "" });

      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Total Events</div>
          <div className="text-2xl font-bold">{counts.total}</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Pending Review</div>
          <div className="text-2xl font-bold text-yellow-400">{counts.pending}</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Approved</div>
          <div className="text-2xl font-bold text-green-400">{counts.approved}</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Drafts</div>
          <div className="text-2xl font-bold text-gray-400">{counts.draft}</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Rejected</div>
          <div className="text-2xl font-bold text-red-400">{counts.rejected}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveStatus(tab.id);
              fetchList(tab.id);
            }}
            className={`btn-secondary text-sm ${
              activeStatus === tab.id ? "bg-accent text-white" : ""
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {listError && (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
          {listError}
        </div>
      )}

      {events.length === 0 ? (
        <div className="card-glass p-8 text-center">
          <p className="text-muted">No events in this status.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="card-glass p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{event.title}</h3>
                    <span className="px-2 py-1 bg-yellow-600 text-yellow-100 rounded text-xs font-semibold">
                      Pending Review
                    </span>
                  </div>
                  {event.description && (
                    <p className="text-muted mb-2">{event.description}</p>
                  )}
                  <div className="text-sm text-muted space-y-1">
                    <div>
                      <strong>Vendor:</strong> {event.vendor_name || "N/A"}
                      <span className="ml-2">({event.vendor_email || "N/A"})</span>
                    </div>
                    <div>
                      <strong>Start:</strong> {new Date(event.start_time).toLocaleString()}
                    </div>
                    <div>
                      <strong>End:</strong> {new Date(event.end_time).toLocaleString()}
                    </div>
                    {event.location && (
                      <div>
                        <strong>Location:</strong> {event.location}
                      </div>
                    )}
                    <div>
                      <strong>Submitted:</strong> {new Date(event.submitted_at).toLocaleString()}
                    </div>
                  </div>
                  {showRejectForm === event.id && (
                    <div className="mt-4 p-4 bg-red-900/30 border border-red-600 rounded">
                      <label className="block text-sm font-medium mb-2">
                        Rejection Reason <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        value={rejectionReason[event.id] || ""}
                        onChange={(e) =>
                          setRejectionReason({ ...rejectionReason, [event.id]: e.target.value })
                        }
                        rows={3}
                        className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                        placeholder="Explain why this event is being rejected..."
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  {showRejectForm !== event.id ? (
                    <>
                      <button
                        onClick={() => handleApprove(event.id)}
                        disabled={loading === event.id}
                        className="btn-primary disabled:opacity-50 whitespace-nowrap"
                      >
                        {loading === event.id ? "Processing..." : "✓ Approve"}
                      </button>
                      <button
                        onClick={() => setShowRejectForm(event.id)}
                        disabled={loading === event.id}
                        className="btn-secondary disabled:opacity-50 whitespace-nowrap"
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleReject(event.id)}
                        disabled={loading === event.id || !rejectionReason[event.id]?.trim()}
                        className="btn-secondary bg-red-600 hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        {loading === event.id ? "Processing..." : "Confirm Reject"}
                      </button>
                      <button
                        onClick={() => {
                          setShowRejectForm(null);
                          setRejectionReason({ ...rejectionReason, [event.id]: "" });
                        }}
                        disabled={loading === event.id}
                        className="btn-secondary disabled:opacity-50 whitespace-nowrap"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
