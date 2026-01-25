"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Inquiry = {
  id: string;
  service_id?: string | null;
  vendor_id?: string | null;
  owner_user_id?: string | null;
  requester_name?: string | null;
  requester_email?: string | null;
  requester_phone?: string | null;
  message?: string | null;
  status?: string | null;
  vendor_note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  services: {
    id: string;
    name?: string | null;
    title?: string | null;
    slug?: string | null;
  } | null;
  vendors: {
    id: string;
    business_name?: string | null;
    owner_user_id?: string | null;
  } | null;
};

type Props = {
  initialInquiries: Inquiry[];
};

const DEFAULT_STATUSES = ["new", "in_progress", "resolved", "closed"] as const;

const normalizeStatus = (status?: string | null) => {
  if (status === null || status === undefined) {
    return "new";
  }
  const normalized = status.toLowerCase().trim();
  return normalized || "new";
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "new":
      return "New";
    case "replied":
      return "Replied";
    case "in_progress":
      return "In Progress";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default:
      return "Unknown";
  }
};

const getStatusClass = (status: string) => {
  switch (status) {
    case "new":
      return "bg-yellow-600 text-yellow-100";
    case "replied":
      return "bg-blue-600 text-blue-100";
    case "in_progress":
      return "bg-blue-600 text-blue-100";
    case "resolved":
      return "bg-green-600 text-green-100";
    case "closed":
      return "bg-gray-600 text-gray-200";
    default:
      return "bg-orange-600 text-orange-100";
  }
};

export default function AdminInquiriesClient({ initialInquiries }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [inquiries, setInquiries] = useState<Inquiry[]>(initialInquiries);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});
  const [savingNote, setSavingNote] = useState<Record<string, boolean>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [rowMessage, setRowMessage] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [activeStatus, setActiveStatus] = useState("all");

  const statusOptions = useMemo(() => {
    const fromData = new Set(
      inquiries.map((inq) => normalizeStatus(inq.status)).filter(Boolean)
    );
    const combined = Array.from(new Set([...DEFAULT_STATUSES, ...fromData]));
    return ["all", ...combined];
  }, [inquiries]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: inquiries.length };
    for (const inq of inquiries) {
      const status = normalizeStatus(inq.status);
      counts[status] = (counts[status] || 0) + 1;
    }
    return counts;
  }, [inquiries]);

  const suggestedDefaultStatus = useMemo(() => {
    const priority = ["new", "in_progress", "resolved", "closed"];
    for (const status of priority) {
      if ((statusCounts[status] || 0) > 0) {
        return status;
      }
    }
    const fallback = statusOptions.find(
      (status) => status !== "all" && (statusCounts[status] || 0) > 0
    );
    return fallback || "new";
  }, [statusCounts, statusOptions]);

  const hasStatusField = useMemo(
    () => inquiries.some((inq) => Object.prototype.hasOwnProperty.call(inq, "status")),
    [inquiries]
  );

  const showVendorNote = useMemo(
    () => inquiries.some((inq) => inq.vendor_note !== undefined),
    [inquiries]
  );

  const fetchInquiries = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const response = await fetch("/api/admin/inquiries", {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setLoadError(payload?.error || "Failed to load inquiries");
        setLoading(false);
        return;
      }
      setInquiries(payload.data || []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load inquiries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  useEffect(() => {
    if (loading) return;
    const paramStatus = searchParams.get("status");
    const validStatuses = statusOptions;
    if (paramStatus && validStatuses.includes(paramStatus)) {
      setActiveStatus(paramStatus);
      return;
    }
    const fallback = suggestedDefaultStatus;
    setActiveStatus(fallback);
    router.replace(`${pathname}?status=${fallback}`);
  }, [loading, pathname, router, searchParams, statusOptions, suggestedDefaultStatus]);

  const handleTabClick = (status: string) => {
    setActiveStatus(status);
    router.replace(`${pathname}?status=${status}`);
  };

  const filteredInquiries = inquiries.filter((inquiry) => {
    const matchesSearch =
      !searchTerm ||
      inquiry.requester_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.requester_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.services?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.services?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inquiry.vendors?.business_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const normalized = normalizeStatus(inquiry.status);
    const matchesStatus = activeStatus === "all" || normalized === activeStatus;

    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (inquiryId: string, nextStatus: string) => {
    const current = inquiries.find((inq) => inq.id === inquiryId);
    if (!current) return;

    setSavingStatus((prev) => ({ ...prev, [inquiryId]: true }));
    setRowMessage((prev) => ({ ...prev, [inquiryId]: "" }));

    const previousStatus = current.status || "unknown";
    setInquiries((prev) =>
      prev.map((inq) =>
        inq.id === inquiryId ? { ...inq, status: nextStatus, updated_at: new Date().toISOString() } : inq
      )
    );

    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setInquiries((prev) =>
          prev.map((inq) =>
            inq.id === inquiryId ? { ...inq, status: previousStatus } : inq
          )
        );
        setRowMessage((prev) => ({
          ...prev,
          [inquiryId]: payload?.error || "Failed to update status",
        }));
        return;
      }
      setRowMessage((prev) => ({ ...prev, [inquiryId]: "Saved" }));
    } catch (error) {
      setInquiries((prev) =>
        prev.map((inq) =>
          inq.id === inquiryId ? { ...inq, status: previousStatus } : inq
        )
      );
      setRowMessage((prev) => ({
        ...prev,
        [inquiryId]: error instanceof Error ? error.message : "Failed to update status",
      }));
    } finally {
      setSavingStatus((prev) => ({ ...prev, [inquiryId]: false }));
    }
  };

  const handleNoteSave = async (inquiryId: string) => {
    const note = noteDraft[inquiryId] ?? "";
    setSavingNote((prev) => ({ ...prev, [inquiryId]: true }));
    setRowMessage((prev) => ({ ...prev, [inquiryId]: "" }));

    try {
      const response = await fetch(`/api/admin/inquiries/${inquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_note: note }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setRowMessage((prev) => ({
          ...prev,
          [inquiryId]: payload?.error || "Failed to save note",
        }));
        return;
      }
      setInquiries((prev) =>
        prev.map((inq) =>
          inq.id === inquiryId ? { ...inq, vendor_note: note, updated_at: payload.data?.updated_at || inq.updated_at } : inq
        )
      );
      setRowMessage((prev) => ({ ...prev, [inquiryId]: "Saved" }));
    } catch (error) {
      setRowMessage((prev) => ({
        ...prev,
        [inquiryId]: error instanceof Error ? error.message : "Failed to save note",
      }));
    } finally {
      setSavingNote((prev) => ({ ...prev, [inquiryId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card-glass p-6">
          <div className="h-4 w-48 bg-[var(--surface)]/60 rounded mb-4" />
          <div className="h-3 w-full bg-[var(--surface)]/40 rounded" />
        </div>
        <div className="card-glass p-6">
          <div className="h-4 w-64 bg-[var(--surface)]/60 rounded mb-4" />
          <div className="h-3 w-full bg-[var(--surface)]/40 rounded" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!hasStatusField && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 text-yellow-300 text-sm">
          Status field is missing from inquiry records. Verify the `service_inquiries.status` column exists.
        </div>
      )}
      <div className="flex flex-col md:flex-row gap-4">
        <input
          type="text"
          placeholder="Search by email, name, service, or vendor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        {statusOptions.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => handleTabClick(status)}
            className={`btn-secondary text-sm ${
              activeStatus === status ? "bg-accent text-white" : ""
            }`}
          >
            {getStatusLabel(status)} ({statusCounts[status] || 0})
          </button>
        ))}
      </div>

      <div className="text-sm text-muted">
        Showing {filteredInquiries.length} of {inquiries.length} inquiries
      </div>

      {filteredInquiries.length === 0 ? (
        <div className="card-glass p-8 text-center">
          <p className="text-muted">
            {activeStatus === "all" ? "No inquiries found." : "No inquiries in this status."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInquiries.map((inquiry) => {
            const normalizedStatus = normalizeStatus(inquiry.status);
            const rowId = inquiry.id;
            const statusValue = statusOptions.includes(normalizedStatus)
              ? normalizedStatus
              : "unknown";

            return (
              <div key={inquiry.id} className="card-glass p-6">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold">
                        {inquiry.services?.name || inquiry.services?.title || "Unknown Service"}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusClass(statusValue)}`}>
                        {getStatusLabel(statusValue)}
                      </span>
                    </div>
                    <div className="text-xs text-muted">ID: {inquiry.id?.slice(0, 8) || "unknown"}</div>
                  </div>

                  <div className="text-sm text-muted space-y-1">
                    <div>
                      <strong>Requester:</strong> {inquiry.requester_name || "Anonymous"}{" "}
                      {inquiry.requester_email ? `(${inquiry.requester_email})` : ""}
                    </div>
                    {inquiry.requester_phone && (
                      <div>
                        <strong>Phone:</strong> {inquiry.requester_phone}
                      </div>
                    )}
                    <div>
                      <strong>Vendor:</strong> {inquiry.vendors?.business_name || inquiry.vendor_id || "Unknown"}
                    </div>
                    {inquiry.created_at && (
                      <div>
                        <strong>Received:</strong> {new Date(inquiry.created_at).toLocaleString()}
                      </div>
                    )}
                    {inquiry.updated_at && inquiry.updated_at !== inquiry.created_at && (
                      <div>
                        <strong>Updated:</strong> {new Date(inquiry.updated_at).toLocaleString()}
                      </div>
                    )}
                  </div>

                  {inquiry.message && (
                    <div className="bg-[var(--surface)] p-4 rounded">
                      <p className="text-sm whitespace-pre-wrap">{inquiry.message}</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="text-sm text-muted">Status</label>
                      <select
                        value={statusValue}
                        onChange={(e) => handleStatusChange(rowId, e.target.value)}
                        disabled={savingStatus[rowId]}
                        className="px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded text-sm text-white"
                      >
                        {statusOptions
                          .filter((status) => status !== "all")
                          .map((status) => (
                            <option key={status} value={status}>
                              {getStatusLabel(status)}
                            </option>
                          ))}
                      </select>
                      {savingStatus[rowId] && <span className="text-xs text-muted">Saving...</span>}
                    </div>

                    {showVendorNote && (
                      <div className="space-y-2">
                        <label className="text-sm text-muted">Vendor Note</label>
                        <textarea
                          rows={3}
                          value={noteDraft[rowId] ?? inquiry.vendor_note ?? ""}
                          onChange={(e) =>
                            setNoteDraft((prev) => ({ ...prev, [rowId]: e.target.value }))
                          }
                          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded p-2 text-sm text-white"
                        />
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleNoteSave(rowId)}
                            disabled={savingNote[rowId]}
                            className="btn-secondary text-sm"
                          >
                            {savingNote[rowId] ? "Saving..." : "Save Note"}
                          </button>
                          {rowMessage[rowId] && (
                            <span className={`text-xs ${rowMessage[rowId] === "Saved" ? "text-green-400" : "text-red-400"}`}>
                              {rowMessage[rowId]}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {!showVendorNote && rowMessage[rowId] && (
                      <span className={`text-xs ${rowMessage[rowId] === "Saved" ? "text-green-400" : "text-red-400"}`}>
                        {rowMessage[rowId]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
