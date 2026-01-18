"use client";

import { useState } from "react";

type Application = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  city: string;
  state: string;
  vehicle_type: string;
  status: string;
  created_at: string;
};

type Driver = {
  id: string;
  user_id: string;
  status: string;
  created_at: string;
};

type Props = {
  initialApplications: Application[];
  initialDrivers: Driver[];
};

export default function DriversClient({ initialApplications, initialDrivers }: Props) {
  const [applications, setApplications] = useState<Application[]>(initialApplications);
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);

  const updateApplicationStatus = async (id: string, status: "approved" | "rejected") => {
    try {
      const response = await fetch(`/api/admin/drivers/${id}`, {
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
      setApplications(applications.map(app => 
        app.id === id ? { ...app, status } : app
      ));

      // If approved, refresh page to show driver in drivers list
      if (status === "approved") {
        window.location.reload();
      }
    } catch (error) {
      alert("Failed to update application status");
    }
  };

  return (
    <div className="space-y-8">
      <div className="card-glass p-6">
        <h2 className="text-2xl font-bold mb-4">Driver Applications</h2>
        {applications.length === 0 ? (
          <p className="text-muted">No applications found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="pb-3 font-semibold text-muted">Name</th>
                  <th className="pb-3 font-semibold text-muted">Contact</th>
                  <th className="pb-3 font-semibold text-muted">Location</th>
                  <th className="pb-3 font-semibold text-muted">Vehicle</th>
                  <th className="pb-3 font-semibold text-muted">Status</th>
                  <th className="pb-3 font-semibold text-muted">Applied</th>
                  <th className="pb-3 font-semibold text-muted">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} className="border-b border-[var(--border)]/60">
                    <td className="py-3 font-semibold">{app.full_name}</td>
                    <td className="py-3 text-muted">{app.phone}</td>
                    <td className="py-3 text-muted">{app.city}, {app.state}</td>
                    <td className="py-3 text-muted">{app.vehicle_type}</td>
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

      <div className="card-glass p-6">
        <h2 className="text-2xl font-bold mb-4">Approved Drivers</h2>
        {drivers.length === 0 ? (
          <p className="text-muted">No approved drivers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-[var(--border)]">
                <tr>
                  <th className="pb-3 font-semibold text-muted">User ID</th>
                  <th className="pb-3 font-semibold text-muted">Status</th>
                  <th className="pb-3 font-semibold text-muted">Joined</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map((driver) => (
                  <tr key={driver.id} className="border-b border-[var(--border)]/60">
                    <td className="py-3 text-muted font-mono text-sm">{driver.user_id.slice(0, 8)}...</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        driver.status === "approved"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}>
                        {driver.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 text-muted">
                      {new Date(driver.created_at).toLocaleDateString()}
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
