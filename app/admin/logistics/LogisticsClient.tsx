"use client";

import { useState } from "react";

type Application = {
  id: string;
  user_id: string;
  company_name: string;
  authority_url: string;
  insurance_cert_url: string;
  w9_url: string | null;
  status: string;
  created_at: string;
};

type Props = {
  initialApplications: Application[];
};

export default function LogisticsClient({ initialApplications }: Props) {
  const [applications, setApplications] = useState<Application[]>(initialApplications);

  const updateApplicationStatus = async (id: string, status: "approved" | "rejected") => {
    try {
      const response = await fetch(`/api/admin/logistics/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to update application status");
        return;
      }

      setApplications(applications.map(app => 
        app.id === id ? { ...app, status } : app
      ));
    } catch (error) {
      alert("Failed to update application status");
    }
  };

  return (
    <div className="space-y-8">
      <div className="card-glass p-6">
        <h2 className="text-2xl font-bold mb-4">Logistics Applications</h2>
        {applications.length === 0 ? (
          <p className="text-muted">No applications found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="pb-3 font-semibold text-muted">Company</th>
                  <th className="pb-3 font-semibold text-muted">Documents</th>
                  <th className="pb-3 font-semibold text-muted">Status</th>
                  <th className="pb-3 font-semibold text-muted">Applied</th>
                  <th className="pb-3 font-semibold text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} className="border-b border-[var(--border)]/60">
                    <td className="py-3 font-semibold">{app.company_name}</td>
                    <td className="py-3">
                      <div className="flex flex-col gap-1 text-sm">
                        {app.authority_url && (
                          <a href={app.authority_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                            Authority
                          </a>
                        )}
                        {app.insurance_cert_url && (
                          <a href={app.insurance_cert_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                            Insurance
                          </a>
                        )}
                        {app.w9_url && (
                          <a href={app.w9_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                            W-9
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        app.status === "approved"
                          ? "bg-green-500/20 text-green-400"
                          : app.status === "rejected"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}>
                        {app.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 text-muted">
                      {new Date(app.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      {app.status === "pending" && (
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
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
