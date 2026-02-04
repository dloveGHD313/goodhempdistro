"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type MissingVendor = {
  application_id: string;
  user_id: string;
  business_name: string;
  created_at: string;
};

type RoleVendorMismatch = {
  user_id: string;
  profile_role: string;
  vendor_status: string | null;
  has_vendor: boolean;
};

type ActiveWithoutSubscription = {
  vendor_id: string;
  business_name: string;
  status: string;
};

type Props = {
  initialData: {
    missingVendors: MissingVendor[];
    counts: {
      approvedApplications: number;
      activeVendors: number;
      missing: number;
    };
    roleVendorMismatch?: RoleVendorMismatch[];
    activeWithoutSubscription?: ActiveWithoutSubscription[];
    error?: string;
  };
};

export default function IntegrityClient({ initialData }: Props) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [fixResult, setFixResult] = useState<{
    success: boolean;
    created: number;
    error?: string;
  } | null>(null);

  const handleFixVendors = async () => {
    if (!confirm("This will create vendor rows for all approved applications missing vendor records. Continue?")) {
      return;
    }

    setLoading(true);
    setFixResult(null);

    try {
      const response = await fetch("/api/admin/vendors/integrity/fix", {
        method: "POST",
      });

      const result = await response.json();

      if (!response.ok) {
        setFixResult({
          success: false,
          created: 0,
          error: result.error || "Failed to fix vendor rows",
        });
        setLoading(false);
        return;
      }

      setFixResult({
        success: true,
        created: result.created || 0,
      });

      // Refresh the page to show updated data
      router.refresh();
      setTimeout(() => {
        router.refresh();
      }, 1000);
    } catch (err) {
      setFixResult({
        success: false,
        created: 0,
        error: err instanceof Error ? err.message : "An unexpected error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Approved Applications</div>
          <div className="text-2xl font-bold">{data.counts.approvedApplications}</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Active Vendors</div>
          <div className="text-2xl font-bold text-green-400">{data.counts.activeVendors}</div>
        </div>
        <div className="card-glass p-4">
          <div className="text-sm text-muted">Missing Vendor Rows</div>
          <div className={`text-2xl font-bold ${data.counts.missing > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {data.counts.missing}
          </div>
        </div>
      </div>

      {/* Status Message */}
      {data.counts.missing === 0 ? (
        <div className="card-glass p-6 text-center">
          <div className="text-green-400 text-2xl mb-2">✅</div>
          <p className="text-lg font-semibold">All approved applications have vendor rows.</p>
          <p className="text-muted mt-2">No integrity issues detected.</p>
        </div>
      ) : (
        <>
          <div className="card-glass p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-red-400 mb-2">
                  ⚠️ Integrity Issue Detected
                </h2>
                <p className="text-muted">
                  {data.counts.missing} approved vendor application{data.counts.missing !== 1 ? 's' : ''} {data.counts.missing !== 1 ? 'are' : 'is'} missing vendor row{data.counts.missing !== 1 ? 's' : ''}.
                </p>
              </div>
              <button
                onClick={handleFixVendors}
                disabled={loading}
                className="btn-primary disabled:opacity-50 whitespace-nowrap"
              >
                {loading ? "Fixing..." : "Fix Vendor Rows"}
              </button>
            </div>

            {fixResult && (
              <div className={`mt-4 p-4 rounded-lg ${fixResult.success ? 'bg-green-900/30 border border-green-600' : 'bg-red-900/30 border border-red-600'}`}>
                {fixResult.success ? (
                  <p className="text-green-400">
                    ✅ Successfully created {fixResult.created} vendor row{fixResult.created !== 1 ? 's' : ''}.
                  </p>
                ) : (
                  <p className="text-red-400">
                    ❌ Error: {fixResult.error || "Unknown error"}
                  </p>
                )}
              </div>
            )}

            {/* Missing Vendors List */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Missing Vendor Rows</h3>
              {data.missingVendors.length === 0 ? (
                <p className="text-muted">None</p>
              ) : (
                <div className="space-y-3">
                  {data.missingVendors.map((missing) => (
                    <div key={missing.application_id} className="p-4 bg-red-900/20 border border-red-600/50 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{missing.business_name}</p>
                          <p className="text-sm text-muted mt-1">
                            User ID: {missing.user_id}
                          </p>
                          <p className="text-sm text-muted">
                            Application ID: {missing.application_id}
                          </p>
                          <p className="text-sm text-muted">
                            Approved: {new Date(missing.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Role / Vendor integrity (read-only; no auto-fix) */}
      <div className="card-glass p-6">
        <h2 className="text-xl font-semibold mb-2">Role &amp; Vendor Status</h2>
        <p className="text-sm text-muted mb-4">
          Checks: profile.role === &quot;vendor&quot; ⇒ vendor.status === &quot;active&quot;; vendor.status === &quot;active&quot; ⇒ stripe_subscription_id exists. No auto-fix.
        </p>
        {((data as { roleVendorMismatch?: RoleVendorMismatch[] }).roleVendorMismatch?.length ?? 0) > 0 && (
          <div className="mb-4 p-4 bg-amber-900/20 border border-amber-600/50 rounded-lg">
            <h3 className="font-semibold text-amber-400 mb-2">Profile role vendor but vendor not active</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              {(data as { roleVendorMismatch?: RoleVendorMismatch[] }).roleVendorMismatch!.map((r) => (
                <li key={r.user_id}>
                  user_id: {r.user_id.slice(0, 8)}… — vendor: {r.has_vendor ? r.vendor_status ?? "null" : "missing"}
                </li>
              ))}
            </ul>
          </div>
        )}
        {((data as { activeWithoutSubscription?: ActiveWithoutSubscription[] }).activeWithoutSubscription?.length ?? 0) > 0 && (
          <div className="p-4 bg-amber-900/20 border border-amber-600/50 rounded-lg">
            <h3 className="font-semibold text-amber-400 mb-2">Vendor status active but no Stripe subscription ID</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              {(data as { activeWithoutSubscription?: ActiveWithoutSubscription[] }).activeWithoutSubscription!.map((v) => (
                <li key={v.vendor_id}>
                  {v.business_name || v.vendor_id.slice(0, 8)}… (vendor_id: {v.vendor_id.slice(0, 8)}…)
                </li>
              ))}
            </ul>
          </div>
        )}
        {(data as { roleVendorMismatch?: RoleVendorMismatch[] }).roleVendorMismatch?.length === 0 &&
          (data as { activeWithoutSubscription?: ActiveWithoutSubscription[] }).activeWithoutSubscription?.length === 0 && (
          <p className="text-muted text-sm">No role/vendor or subscription mismatches.</p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-4">
        <Link href="/admin/vendors" className="btn-secondary">
          ← Back to Vendor Applications
        </Link>
      </div>
    </div>
  );
}
