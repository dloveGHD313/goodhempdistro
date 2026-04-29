"use client";

import { useState } from "react";

export default function ConnectButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vendor/connect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) {
        setError(data?.error ?? "Failed to create onboarding link");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Failed to create onboarding link");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onConnect}
        disabled={loading}
        className="rounded-md px-4 py-2 text-white font-medium disabled:opacity-60"
        style={{ backgroundColor: "#3CB97A" }}
      >
        {loading ? "Redirecting…" : "Connect with Stripe"}
      </button>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
