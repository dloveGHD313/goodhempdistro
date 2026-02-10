"use client";

import { useEffect, useMemo, useState } from "react";

type DriverConnectStatus = {
  connected: boolean;
  stripe_account_id: string | null;
  details_submitted: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  payout_ready: boolean;
};

function getRef(response: Response, data: { requestId?: string } | null): string {
  const requestId = response.headers.get("X-Request-Id") ?? data?.requestId;
  return requestId ?? "unknown";
}

export default function DriverConnectCard() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<DriverConnectStatus | null>(null);

  const payoutReady = useMemo(() => Boolean(status?.payout_ready), [status]);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/driver/connect/status", { cache: "no-store" });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(`Failed to load payout status. Reference: ${getRef(response, data)}`);
        setStatus(null);
        return;
      }

      setStatus({
        connected: Boolean(data?.connected),
        stripe_account_id: data?.stripe_account_id ?? null,
        details_submitted: Boolean(data?.details_submitted),
        charges_enabled: Boolean(data?.charges_enabled),
        payouts_enabled: Boolean(data?.payouts_enabled),
        payout_ready: Boolean(data?.payout_ready),
      });
    } catch {
      setError("Failed to load payout status. Reference: unknown");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const createResponse = await fetch("/api/driver/connect/create-account", { method: "POST" });
      const createData = await createResponse.json().catch(() => null);
      if (!createResponse.ok) {
        setError(`Onboarding failed. Reference: ${getRef(createResponse, createData)}`);
        setConnecting(false);
        return;
      }

      const linkResponse = await fetch("/api/driver/connect/onboard-link", { method: "POST" });
      const linkData = await linkResponse.json().catch(() => null);
      if (!linkResponse.ok || !linkData?.url) {
        setError(`Onboarding failed. Reference: ${getRef(linkResponse, linkData)}`);
        setConnecting(false);
        return;
      }

      window.location.href = linkData.url;
    } catch {
      setError("Onboarding failed. Reference: unknown");
      setConnecting(false);
    }
  };

  return (
    <div className="card-glass p-6 mb-8">
      <h2 className="text-2xl font-bold mb-2">Payouts / Get Paid</h2>
      {loading ? (
        <p className="text-muted">Loading payout readiness…</p>
      ) : (
        <>
          {error && (
            <div className="mb-4 rounded border border-red-500/50 bg-red-900/30 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="text-sm text-muted space-y-1 mb-4">
            <div>Connected: {status?.connected ? "Yes" : "No"}</div>
            <div>Details submitted: {status?.details_submitted ? "Yes" : "No"}</div>
            <div>Charges enabled: {status?.charges_enabled ? "Yes" : "No"}</div>
            <div>Payouts enabled: {status?.payouts_enabled ? "Yes" : "No"}</div>
            <div className={payoutReady ? "text-green-400" : "text-yellow-400"}>
              Payout ready: {payoutReady ? "Yes" : "No"}
            </div>
          </div>

          {!payoutReady && (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="btn-primary disabled:opacity-50"
            >
              {connecting ? "Redirecting…" : "Connect Stripe"}
            </button>
          )}

          <div className="mt-4">
            <button
              type="button"
              disabled={!payoutReady}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              title={payoutReady ? "Driver is payout-ready. Cash-out flow pending implementation." : "Connect Stripe to become payout-ready"}
            >
              Cash Out (Coming Soon)
            </button>
            {payoutReady && <p className="text-sm text-green-400 mt-2">Ready for payouts.</p>}
          </div>
        </>
      )}
    </div>
  );
}
