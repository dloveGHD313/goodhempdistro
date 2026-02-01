"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type AuditEntry = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  prev_status: string | null;
  new_status: string | null;
  reason: string | null;
};

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "approve", label: "Approve" },
  { value: "reject", label: "Reject" },
  { value: "set_active", label: "Set Active" },
  { value: "set_inactive", label: "Set Inactive" },
  { value: "delete", label: "Delete" },
  { value: "status", label: "Status" },
];

const formatDate = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
};

export default function AuditLogClient() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [entityIdSearch, setEntityIdSearch] = useState("");
  const [actorEmailSearch, setActorEmailSearch] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    action: "",
    entity_id: "",
    actor_email: "",
  });

  const fetchLog = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (appliedFilters.action) params.set("action", appliedFilters.action);
      if (appliedFilters.entity_id) params.set("entity_id", appliedFilters.entity_id);
      if (appliedFilters.actor_email) params.set("actor_email", appliedFilters.actor_email);
      const url = `/api/admin/audit${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setError(payload?.error || "Failed to load audit log");
        setEntries([]);
        return;
      }
      setEntries(payload.data || []);
    } catch (e) {
      setError("Failed to load audit log");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLog();
  }, [appliedFilters]);

  const applyFilters = () => {
    setAppliedFilters({
      action: actionFilter.trim(),
      entity_id: entityIdSearch.trim(),
      actor_email: actorEmailSearch.trim(),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 p-4 bg-gray-800/50 rounded-lg">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Action</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 min-w-[140px]"
          >
            {ACTION_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Product ID</label>
          <input
            type="text"
            placeholder="UUID or partial"
            value={entityIdSearch}
            onChange={(e) => setEntityIdSearch(e.target.value)}
            className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 w-48"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Actor email</label>
          <input
            type="text"
            placeholder="Search by email"
            value={actorEmailSearch}
            onChange={(e) => setActorEmailSearch(e.target.value)}
            className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 w-48"
          />
        </div>
        <button type="button" onClick={applyFilters} className="btn-primary">
          Apply filters
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-600 rounded text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Loading audit log…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-600 rounded overflow-hidden">
            <thead className="bg-gray-800 text-left">
              <tr>
                <th className="p-3 text-gray-300 font-medium">Time</th>
                <th className="p-3 text-gray-300 font-medium">Action</th>
                <th className="p-3 text-gray-300 font-medium">Product</th>
                <th className="p-3 text-gray-300 font-medium">Actor</th>
                <th className="p-3 text-gray-300 font-medium">Status change</th>
                <th className="p-3 text-gray-300 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-400">
                    No audit entries found.
                  </td>
                </tr>
              ) : (
                entries.map((row) => (
                  <tr key={row.id} className="bg-gray-800/30 hover:bg-gray-800/50">
                    <td className="p-3 text-gray-300 whitespace-nowrap">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-gray-600 text-gray-200 text-sm">
                        {row.action}
                      </span>
                    </td>
                    <td className="p-3">
                      {row.entity_type === "product" ? (
                        <Link
                          href={`/admin/products/${row.entity_id}`}
                          className="text-accent hover:underline font-mono text-sm"
                        >
                          {row.entity_id.slice(0, 8)}…
                        </Link>
                      ) : (
                        <span className="font-mono text-sm text-gray-400">
                          {row.entity_id.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-gray-300 text-sm">
                      {row.actor_email || row.actor_user_id || "—"}
                    </td>
                    <td className="p-3 text-gray-400 text-sm">
                      {row.prev_status && row.new_status
                        ? `${row.prev_status} → ${row.new_status}`
                        : row.new_status || "—"}
                    </td>
                    <td className="p-3 text-gray-400 text-sm max-w-xs truncate" title={row.reason || undefined}>
                      {row.reason || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm text-gray-500">Latest 200 actions. Filters: action type, product ID, actor email.</p>
    </div>
  );
}
