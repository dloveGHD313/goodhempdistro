"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Application = {
  id: string;
  user_id: string;
  status: string;
  business_name: string | null;
  business_type: string | null;
  company_size: string | null;
  products_sourcing: string[] | null;
  certificate_path: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export default function WholesaleAdminClient() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const fetchList = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter
        ? `/api/admin/wholesale/applications?status=${encodeURIComponent(statusFilter)}`
        : "/api/admin/wholesale/applications";
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 403) throw new Error("Forbidden");
        throw new Error("Failed to load applications");
      }
      const data = await res.json();
      setApplications(data.applications ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [statusFilter]);

  const handleReview = async (id: string, status: "approved" | "rejected") => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/wholesale/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          notes: notesById[id] ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Update failed");
      setNotesById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await fetchList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/dashboard/admin" className="text-muted hover:text-white text-sm">
          ← Admin
        </Link>
        <h1 className="text-2xl font-bold text-accent">Wholesale applications</h1>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-muted text-sm">Filter:</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-shell"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {error && (
        <div className="p-3 rounded bg-red-500/20 text-red-200 text-sm" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : applications.length === 0 ? (
        <p className="text-muted">No applications found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-white/20 rounded overflow-hidden">
            <thead>
              <tr className="bg-white/5 text-left">
                <th className="p-3 text-muted font-medium">Business</th>
                <th className="p-3 text-muted font-medium">Type</th>
                <th className="p-3 text-muted font-medium">Size</th>
                <th className="p-3 text-muted font-medium">Status</th>
                <th className="p-3 text-muted font-medium">Submitted</th>
                <th className="p-3 text-muted font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-t border-white/10">
                  <td className="p-3">{app.business_name || "—"}</td>
                  <td className="p-3">{app.business_type || "—"}</td>
                  <td className="p-3">{app.company_size || "—"}</td>
                  <td className="p-3">
                    <span
                      className={
                        app.status === "approved"
                          ? "text-green-400"
                          : app.status === "rejected"
                            ? "text-red-400"
                            : "text-amber-400"
                      }
                    >
                      {app.status}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-muted">
                    {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-3">
                    {app.status === "pending" && (
                      <div className="flex flex-col gap-2">
                        <textarea
                          placeholder="Notes (optional)"
                          value={notesById[app.id] ?? ""}
                          onChange={(e) =>
                            setNotesById((prev) => ({ ...prev, [app.id]: e.target.value }))
                          }
                          className="input-shell text-sm w-40 min-h-[60px]"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleReview(app.id, "approved")}
                            disabled={updatingId === app.id}
                            className="btn-primary text-sm py-1 px-2"
                          >
                            {updatingId === app.id ? "…" : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReview(app.id, "rejected")}
                            disabled={updatingId === app.id}
                            className="btn-secondary text-sm py-1 px-2"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                    {app.status !== "pending" && app.notes && (
                      <span className="text-xs text-muted">{app.notes}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
