"use client";

import { useEffect, useMemo, useState } from "react";

type Verification = {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  notes: string | null;
};

type VerificationFile = {
  id: string;
  verification_id: string;
  url: string;
};

export default function IdVerificationsClient() {
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

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/id-verifications", { cache: "no-store" });
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
    loadQueue();
  }, []);

  const handleAction = async (id: string, action: "verify" | "reject") => {
    setActionLoading(id);
    setError(null);
    try {
      const response = await fetch("/api/admin/id-verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationId: id,
          action,
          notes: notesById[id] || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update verification.");
      }
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update verification.");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="text-muted">Loading verification queue...</div>;
  }

  if (error) {
    return <div className="text-red-300">{error}</div>;
  }

  if (verifications.length === 0) {
    return <div className="text-muted">No verification requests yet.</div>;
  }

  return (
    <div className="space-y-6">
      {verifications.map((verification) => {
        const filesForVerification = filesByVerification[verification.id] || [];
        return (
          <div key={verification.id} className="card-glass p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-sm text-muted">User ID</p>
                <p className="text-sm">{verification.user_id}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Status</p>
                <p className="text-sm capitalize">{verification.status}</p>
              </div>
              <div>
                <p className="text-sm text-muted">Submitted</p>
                <p className="text-sm">{new Date(verification.created_at).toLocaleString()}</p>
              </div>
            </div>

            {filesForVerification.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {filesForVerification.map((file) => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary px-3 py-2 text-xs"
                  >
                    View ID
                  </a>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm text-muted">Notes (optional)</label>
              <textarea
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
                rows={2}
                value={notesById[verification.id] ?? verification.notes ?? ""}
                onChange={(event) =>
                  setNotesById((prev) => ({ ...prev, [verification.id]: event.target.value }))
                }
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleAction(verification.id, "verify")}
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
          </div>
        );
      })}
    </div>
  );
}
