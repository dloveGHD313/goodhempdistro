"use client";

import { useState } from "react";

export default function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error || "Failed to open billing portal");
        return;
      }
      if (payload?.url) {
        window.location.href = payload.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open billing portal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        className="btn-primary"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? "Opening portal..." : "Manage billing"}
      </button>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  );
}
