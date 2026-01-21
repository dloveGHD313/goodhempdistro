"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Inquiry = {
  id: string;
  service_id: string;
  requester_name?: string;
  requester_email: string;
  requester_phone?: string;
  message: string;
  status: 'new' | 'replied' | 'closed';
  vendor_note?: string;
  created_at: string;
  updated_at: string;
  services: {
    id: string;
    name?: string;
    title: string;
    slug?: string;
  } | null;
};

type Props = {
  initialInquiries: Inquiry[];
  initialCounts: {
    new: number;
    replied: number;
    closed: number;
    total: number;
  };
};

export default function InquiriesClient({ initialInquiries, initialCounts }: Props) {
  const router = useRouter();
  const [inquiries, setInquiries] = useState<Inquiry[]>(initialInquiries);
  const [counts, setCounts] = useState(initialCounts);
  const [filter, setFilter] = useState<'all' | 'new' | 'replied' | 'closed'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusUpdate, setStatusUpdate] = useState<Partial<Record<string, 'new' | 'replied' | 'closed'>>>({});
  const [vendorNote, setVendorNote] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const handleUpdate = async (inquiryId: string) => {
    setSaving(inquiryId);
    try {
      const response = await fetch(`/api/vendors/inquiries/${inquiryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusUpdate[inquiryId] || inquiries.find(i => i.id === inquiryId)?.status,
          vendor_note: vendorNote[inquiryId] || inquiries.find(i => i.id === inquiryId)?.vendor_note || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to update inquiry");
        setSaving(null);
        return;
      }

      // Update local state
      setInquiries(inquiries.map(inq => 
        inq.id === inquiryId 
          ? { ...inq, status: data.inquiry.status, vendor_note: data.inquiry.vendor_note || null }
          : inq
      ));

      // Update counts
      const oldStatus = inquiries.find(i => i.id === inquiryId)?.status;
      const newStatus = data.inquiry.status;
      if (oldStatus !== newStatus && oldStatus && newStatus) {
        setCounts({
          ...counts,
          [oldStatus]: Math.max(0, (counts[oldStatus as keyof typeof counts] as number) - 1),
          [newStatus]: ((counts[newStatus as keyof typeof counts] as number) || 0) + 1,
        });
      }

      setEditingId(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An unexpected error occurred");
      setSaving(null);
    } finally {
      setSaving(null);
    }
  };

  const filteredInquiries = filter === 'all' 
    ? inquiries 
    : inquiries.filter(i => i.status === filter);

  const getStatusBadge = (status: Inquiry['status']) => {
    const classes = {
      new: "bg-yellow-600 text-yellow-100",
      replied: "bg-blue-600 text-blue-100",
      closed: "bg-gray-600 text-gray-200",
    };

    const labels = {
      new: "New",
      replied: "Replied",
      closed: "Closed",
    };

    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${classes[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Total</div>
          <div className="text-2xl font-bold">{counts.total}</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-sm text-muted">New</div>
          <div className="text-2xl font-bold text-yellow-400">{counts.new}</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Replied</div>
          <div className="text-2xl font-bold text-blue-400">{counts.replied}</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Closed</div>
          <div className="text-2xl font-bold text-gray-400">{counts.closed}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded ${filter === 'all' ? 'bg-accent text-white' : 'bg-[var(--surface)] text-white'}`}
        >
          All ({counts.total})
        </button>
        <button
          onClick={() => setFilter('new')}
          className={`px-4 py-2 rounded ${filter === 'new' ? 'bg-accent text-white' : 'bg-[var(--surface)] text-white'}`}
        >
          New ({counts.new})
        </button>
        <button
          onClick={() => setFilter('replied')}
          className={`px-4 py-2 rounded ${filter === 'replied' ? 'bg-accent text-white' : 'bg-[var(--surface)] text-white'}`}
        >
          Replied ({counts.replied})
        </button>
        <button
          onClick={() => setFilter('closed')}
          className={`px-4 py-2 rounded ${filter === 'closed' ? 'bg-accent text-white' : 'bg-[var(--surface)] text-white'}`}
        >
          Closed ({counts.closed})
        </button>
      </div>

      {/* Inquiries List */}
      {filteredInquiries.length === 0 ? (
        <div className="card-glass p-8 text-center">
          <p className="text-muted mb-4">No inquiries found.</p>
          <Link href="/vendors/services" className="btn-primary">
            Manage Services
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInquiries.map((inquiry) => (
            <div key={inquiry.id} className="card-glass p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">
                      {inquiry.services?.name || inquiry.services?.title || 'Unknown Service'}
                    </h3>
                    {getStatusBadge(inquiry.status)}
                  </div>
                  
                  <div className="text-sm text-muted space-y-1 mb-4">
                    <div>
                      <strong>From:</strong> {inquiry.requester_name || 'Anonymous'} ({inquiry.requester_email})
                    </div>
                    {inquiry.requester_phone && (
                      <div>
                        <strong>Phone:</strong> {inquiry.requester_phone}
                      </div>
                    )}
                    <div>
                      <strong>Received:</strong> {new Date(inquiry.created_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="bg-[var(--surface)] p-4 rounded mb-4">
                    <p className="text-sm whitespace-pre-wrap">{inquiry.message}</p>
                  </div>

                  {inquiry.vendor_note && (
                    <div className="bg-yellow-900/30 border border-yellow-600 p-3 rounded mb-4">
                      <p className="text-xs text-yellow-400">
                        <strong>Your Note:</strong> {inquiry.vendor_note}
                      </p>
                    </div>
                  )}

                  {editingId === inquiry.id ? (
                    <div className="space-y-3 mt-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Status</label>
                        <select
                          value={statusUpdate[inquiry.id] || inquiry.status}
                          onChange={(e) => setStatusUpdate({ ...statusUpdate, [inquiry.id]: e.target.value as any })}
                          className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                        >
                          <option value="new">New</option>
                          <option value="replied">Replied</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Internal Note</label>
                        <textarea
                          value={vendorNote[inquiry.id] || inquiry.vendor_note || ""}
                          onChange={(e) => setVendorNote({ ...vendorNote, [inquiry.id]: e.target.value })}
                          rows={3}
                          className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                          placeholder="Add a note for your records..."
                        />
                        <p className="text-xs text-muted mt-1">This note is only visible to you</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdate(inquiry.id)}
                          disabled={saving === inquiry.id}
                          className="btn-primary disabled:opacity-50"
                        >
                          {saving === inquiry.id ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            const { [inquiry.id]: _, ...restStatus } = statusUpdate;
                            const { [inquiry.id]: __, ...restNote } = vendorNote;
                            setStatusUpdate(restStatus);
                            setVendorNote(restNote);
                          }}
                          disabled={saving === inquiry.id}
                          className="btn-secondary disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(inquiry.id);
                        setStatusUpdate({ ...statusUpdate, [inquiry.id]: inquiry.status });
                        setVendorNote({ ...vendorNote, [inquiry.id]: inquiry.vendor_note || "" });
                      }}
                      className="btn-secondary mt-4"
                    >
                      Update Status / Add Note
                    </button>
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
