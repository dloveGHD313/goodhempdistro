"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Verification = {
  id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  reviewed_by?: string | null;
  notes: string | null;
};

type VerificationFile = {
  id: string;
  verification_id: string;
  url: string;
};

export default function IdVerificationsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");
  const statusFilter =
    statusParam === "approved" || statusParam === "rejected" ? statusParam : "pending";
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [files, setFiles] = useState<VerificationFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filesByVerification = useMemo(() => {
    return files.reduce<Record<string, VerificationFile[]>>((acc, file) => {
      acc[file.verification_id] = acc[file.verification_id] || [];
      acc[file.verification_id].push(file);
      return acc;
    }, {});
  }, [files]);

  const loadQueue = async (status: "pending" | "approved" | "rejected") => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/id-verifications?status=${status}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load verification queue.");
      }
      setVerifications(data.verifications || []);
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load verification queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue(statusFilter);
  }, [statusFilter]);

  const handleStatusChange = (next: "pending" | "approved" | "rejected") => {
    if (next === statusFilter) return;
    router.push(`/admin/id-verifications?status=${next}`);
  };

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setActionLoading(id);
    setError(null);
    const previous = verifications;
    setVerifications((current) => current.filter((item) => item.id !== id));
    try {
      const response = await fetch(`/api/admin/id-verifications/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notesById[id] || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update verification.");
      }
    } catch (err) {
      setVerifications(previous);
      setError(err instanceof Error ? err.message : "Failed to update verification.");
    } finally {
      setActionLoading(null);
    }
  };

  if (error) {
    return <div className="text-red-300">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface)]/70 p-1">
        {["pending", "approved", "rejected"].map((status) => {
          const active = statusFilter === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => handleStatusChange(status as "pending" | "approved" | "rejected")}
              className={[
                "px-4 py-2 text-xs uppercase tracking-[0.2em] rounded-lg transition",
                active ? "bg-accent text-black" : "text-muted hover:text-white",
              ].join(" ")}
              aria-pressed={active}
            >
              {status}
            </button>
          );
        })}
      </div>
      <div className="card-glass overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--surface)]/80 text-left">
            <tr>
              <th className="px-4 py-3 text-muted">User</th>
              <th className="px-4 py-3 text-muted">Submitted</th>
              <th className="px-4 py-3 text-muted">ID Preview</th>
              <th className="px-4 py-3 text-muted">Notes</th>
              <th className="px-4 py-3 text-muted">
                {statusFilter === "pending" ? "Actions" : "Reviewed"}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="border-t border-[var(--border)]/60">
                  <td className="px-4 py-4">
                    <div className="h-4 bg-[var(--surface)]/60 rounded w-40 animate-pulse" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 bg-[var(--surface)]/60 rounded w-32 animate-pulse" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-12 w-16 bg-[var(--surface)]/60 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-12 bg-[var(--surface)]/60 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-8 bg-[var(--surface)]/60 rounded w-24 animate-pulse" />
                  </td>
                </tr>
              ))
            ) : verifications.length === 0 ? (
              <tr className="border-t border-[var(--border)]/60">
                <td className="px-4 py-6 text-muted" colSpan={5}>
                  No {statusFilter} verification requests.
                </td>
              </tr>
            ) : (
              verifications.map((verification) => {
                const filesForVerification = filesByVerification[verification.id] || [];
                return (
                  <tr key={verification.id} className="border-t border-[var(--border)]/60">
                    <td className="px-4 py-4 align-top">
                      <div className="text-xs text-muted">User ID</div>
                      <div className="text-sm">{verification.user_id}</div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      {new Date(verification.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        {filesForVerification.length === 0 && (
                          <span className="text-xs text-muted">No files</span>
                        )}
                        {filesForVerification.map((file) => (
                          <a
                            key={file.id}
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block w-16 h-16 rounded-lg overflow-hidden border border-[var(--border)]"
                          >
                            <img
                              src={file.url}
                              alt="ID preview"
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </a>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top w-64">
                      <textarea
                        className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs"
                        rows={3}
                        value={notesById[verification.id] ?? verification.notes ?? ""}
                        onChange={(event) =>
                          setNotesById((prev) => ({
                            ...prev,
                            [verification.id]: event.target.value,
                          }))
                        }
                        placeholder="Optional rejection reason"
                        disabled={statusFilter !== "pending"}
                      />
                    </td>
                    <td className="px-4 py-4 align-top">
                      {statusFilter === "pending" ? (
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => handleAction(verification.id, "approve")}
                            disabled={actionLoading === verification.id}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => handleAction(verification.id, "reject")}
                            disabled={actionLoading === verification.id}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">
                          {verification.reviewed_at
                            ? new Date(verification.reviewed_at).toLocaleString()
                            : "Reviewed"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
