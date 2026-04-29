"use client";

import { useState } from "react";

type TriggerResponse = { processed?: number; errors?: string[]; error?: string };

export default function TriggerPayoutsButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriggerResponse | null>(null);

  const trigger = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/payouts/trigger", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      setResult(data);
    } catch {
      setResult({ error: "Request failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={trigger} disabled={loading} className="btn-primary disabled:opacity-60">
        {loading ? "Triggering…" : "Trigger Payouts"}
      </button>

      {result ? (
        <div className="rounded-lg border border-white/10 p-3 text-sm">
          <pre className="whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  );
}
