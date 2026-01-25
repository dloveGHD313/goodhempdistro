"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Service = {
  id: string;
  name?: string;
  title: string;
  description?: string;
  pricing_type?: string;
  price_cents?: number;
  status: string;
  submitted_at: string;
  category_id?: string;
  vendor_id?: string;
  owner_user_id: string;
  created_at?: string;
};

type Props = {
  initialServices: Service[];
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

export default function ServicesReviewClient({
  initialServices,
  initialCounts,
  initialStatus,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [services, setServices] = useState<Service[]>(initialServices);
  const [counts, setCounts] = useState(initialCounts);
  const [loading, setLoading] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState(initialStatus);
  const [listError, setListError] = useState<string | null>(null);

  const fetchList = async (status: string) => {
    setListError(null);
    const response = await fetch(`/api/admin/services?status=${status}&limit=50`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      setListError(data?.error || "Failed to load services");
      return;
    }
    setServices(data.data || []);
    setCounts(
      data.counts || { total: 0, pending: 0, approved: 0, draft: 0, rejected: 0 }
    );
  };

  useEffect(() => {
    const totalCount =
      (initialCounts.pending || 0) +
      (initialCounts.approved || 0) +
      (initialCounts.draft || 0) +
      (initialCounts.rejected || 0);
    if (initialServices.length === 0 && totalCount > 0) {
      fetchList(initialStatus);
    }
  }, [initialCounts, initialServices.length, initialStatus]);

  useEffect(() => {
    const paramStatus = searchParams.get("status");
    const validStatuses = STATUS_TABS.map((tab) => tab.id);
    if (paramStatus && !validStatuses.includes(paramStatus)) {
      router.replace(`${pathname}?status=${initialStatus}`);
    }
  }, [initialStatus, pathname, router, searchParams]);

  const handleApprove = async (serviceId: string) => {
    setLoading(serviceId);
    try {
      const res = await fetch(`/api/admin/services/${serviceId}/approve`, {
        method: "POST",
      });

      const text = await res.text();
      let payload: any = null;
      try {
        payload = JSON.parse(text);
      } catch {
        // ignore JSON parse errors
      }

      if (!res.ok || payload?.ok === false) {
        const message =
          payload?.error?.message ||
          payload?.message ||
          text ||
          "Failed to approve service";

        const parts: string[] = [message];

        const code = payload?.error?.code;
        const details = payload?.error?.details;
        const hint = payload?.error?.hint;
        const queryContext = payload?.error?.queryContext;
        const buildTag = payload?.diagnostics?.buildTag;

        if (queryContext) parts.push(`queryContext=${queryContext}`);
        if (code) parts.push(`code=${code}`);
        if (details) parts.push(`details=${details}`);
        if (hint) parts.push(`hint=${hint}`);
        if (buildTag) parts.push(`buildTag=${buildTag}`);

        // eslint-disable-next-line no-console
        console.error("approve failed", { status: res.status, payload, text });
        alert(parts.join("\n\n"));
        setLoading(null);
        return;
      }

      setServices(services.filter((s) => s.id !== serviceId));
      setCounts((current) => ({
        ...current,
        pending: current.pending - (activeStatus === "pending_review" ? 1 : 0),
        draft: current.draft - (activeStatus === "draft" ? 1 : 0),
        rejected: current.rejected - (activeStatus === "rejected" ? 1 : 0),
        approved: current.approved + 1,
      }));
      
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(null);
    }
  };

  const handleReject = async (serviceId: string) => {
    const reason = rejectionReason[serviceId]?.trim();
    if (!reason) {
      alert("Rejection reason is required");
      return;
    }

    setLoading(serviceId);
    try {
      const response = await fetch(`/api/admin/services/${serviceId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();

      if (!response.ok || data?.ok === false) {
        alert(data.error || "Failed to reject service");
        setLoading(null);
        return;
      }

      setServices(services.filter((s) => s.id !== serviceId));
      setCounts((current) => ({
        ...current,
        pending: current.pending - (activeStatus === "pending_review" ? 1 : 0),
        draft: current.draft - (activeStatus === "draft" ? 1 : 0),
        approved: current.approved - (activeStatus === "approved" ? 1 : 0),
        rejected: current.rejected + 1,
      }));
      setShowRejectForm(null);
      setRejectionReason({ ...rejectionReason, [serviceId]: "" });
      
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(null);
    }
  };

  const vendorEmail = (service: Service) => {
    // Profile data not available - show owner user ID instead
    return service.owner_user_id ? `User: ${service.owner_user_id.substring(0, 8)}...` : "N/A";
  };

  const businessName = (service: Service) => {
    // Vendor data not available - show vendor ID if present
    return service.vendor_id ? `Vendor: ${service.vendor_id.substring(0, 8)}...` : "N/A";
  };

  const formatPrice = (pricingType?: string, priceCents?: number) => {
    if (!pricingType || pricingType === 'quote_only') {
      return "Quote Only";
    }
    if (!priceCents) {
      return "Price TBD";
    }
    return `$${((priceCents || 0) / 100).toFixed(2)} ${pricingType === 'hourly' ? '/hr' : pricingType === 'per_project' ? '/project' : ''}`;
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Total Services</div>
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
              router.replace(`${pathname}?status=${tab.id}`);
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

      {/* Services List */}
      {services.length === 0 ? (
        <div className="card-glass p-8 text-center">
          <p className="text-muted">No services in this status.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {services.map((service) => (
            <div key={service.id} className="card-glass p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold">{service.name || service.title}</h3>
                    <span className="px-2 py-1 bg-yellow-600 text-yellow-100 rounded text-xs font-semibold">
                      {service.status?.replace("_", " ") || "Pending Review"}
                    </span>
                  </div>
                  {service.description && (
                    <p className="text-muted mb-2">{service.description}</p>
                  )}
                  <div className="text-sm text-muted space-y-1">
                    <div>
                      <strong>Vendor:</strong> {businessName(service)} 
                      <span className="ml-2">({vendorEmail(service)})</span>
                    </div>
                    {service.pricing_type && (
                      <div>
                        <strong>Pricing:</strong> {formatPrice(service.pricing_type, service.price_cents)}
                      </div>
                    )}
                    <div>
                      <strong>Submitted:</strong> {new Date(service.submitted_at).toLocaleString()}
                    </div>
                  </div>
                  {showRejectForm === service.id && (
                    <div className="mt-4 p-4 bg-red-900/30 border border-red-600 rounded">
                      <label className="block text-sm font-medium mb-2">
                        Rejection Reason <span className="text-red-400">*</span>
                      </label>
                      <textarea
                        value={rejectionReason[service.id] || ""}
                        onChange={(e) =>
                          setRejectionReason({ ...rejectionReason, [service.id]: e.target.value })
                        }
                        rows={3}
                        className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                        placeholder="Explain why this service is being rejected..."
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  {showRejectForm !== service.id ? (
                    <>
                      <button
                        onClick={() => handleApprove(service.id)}
                        disabled={loading === service.id}
                        className="btn-primary disabled:opacity-50 whitespace-nowrap"
                      >
                        {loading === service.id ? "Processing..." : "✓ Approve"}
                      </button>
                      <button
                        onClick={() => setShowRejectForm(service.id)}
                        disabled={loading === service.id}
                        className="btn-secondary disabled:opacity-50 whitespace-nowrap"
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleReject(service.id)}
                        disabled={loading === service.id || !rejectionReason[service.id]?.trim()}
                        className="btn-secondary bg-red-600 hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        {loading === service.id ? "Processing..." : "Confirm Reject"}
                      </button>
                      <button
                        onClick={() => {
                          setShowRejectForm(null);
                          setRejectionReason({ ...rejectionReason, [service.id]: "" });
                        }}
                        disabled={loading === service.id}
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
