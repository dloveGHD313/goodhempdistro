"use client";

import { useState } from "react";

type VendorApplication = {
  id: string;
  user_id: string;
  business_name: string;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
  profiles: {
    display_name: string | null;
    email?: string;
  } | null;
};

type Props = {
  initialApplications: VendorApplication[];
};

export default function VendorsClient({ initialApplications }: Props) {
  const [applications, setApplications] = useState<VendorApplication[]>(initialApplications);

  const updateApplicationStatus = async (id: string, status: "approved" | "rejected") => {
    try {
      const response = await fetch(`/api/admin/vendors/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to update application status");
        return;
      }

      // Update local state
      setApplications(applications.map((app) =>
        app.id === id ? { ...app, status } : app
      ));

      // If approved, refresh to show updated list
      if (status === "approved") {
        window.location.reload();
      }
    } catch (error) {
      alert("Failed to update application status");
    }
  };

  const pendingApps = applications.filter((app) => app.status === "pending");
  const otherApps = applications.filter((app) => app.status !== "pending");

  return (
    <div className="space-y-8">
      <div className="card-glass p-6">
        <h2 className="text-2xl font-bold mb-4">Pending Applications</h2>
        {pendingApps.length === 0 ? (
          <p className="text-muted">No pending applications.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="pb-3 font-semibold text-muted">Business Name</th>
                  <th className="pb-3 font-semibold text-muted">Applicant</th>
                  <th className="pb-3 font-semibold text-muted">Description</th>
                  <th className="pb-3 font-semibold text-muted">Applied</th>
                  <th className="pb-3 font-semibold text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingApps.map((app) => (
                  <tr key={app.id} className="border-b border-[var(--border)]/60">
                    <td className="py-3 font-semibold">{app.business_name}</td>
                    <td className="py-3 text-muted">
                      {app.profiles?.display_name || app.profiles?.email || app.user_id.slice(0, 8)}
                    </td>
                    <td className="py-3 text-muted text-sm max-w-md truncate">
                      {app.description || "No description"}
                    </td>
                    <td className="py-3 text-muted">
                      {new Date(app.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateApplicationStatus(app.id, "approved")}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateApplicationStatus(app.id, "rejected")}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {otherApps.length > 0 && (
        <div className="card-glass p-6">
          <h2 className="text-2xl font-bold mb-4">Processed Applications</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="pb-3 font-semibold text-muted">Business Name</th>
                  <th className="pb-3 font-semibold text-muted">Applicant</th>
                  <th className="pb-3 font-semibold text-muted">Status</th>
                  <th className="pb-3 font-semibold text-muted">Processed</th>
                </tr>
              </thead>
              <tbody>
                {otherApps.map((app) => (
                  <tr key={app.id} className="border-b border-[var(--border)]/60">
                    <td className="py-3 font-semibold">{app.business_name}</td>
                    <td className="py-3 text-muted">
                      {app.profiles?.display_name || app.profiles?.email || app.user_id.slice(0, 8)}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        app.status === "approved"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}>
                        {app.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 text-muted">
                      {new Date(app.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
