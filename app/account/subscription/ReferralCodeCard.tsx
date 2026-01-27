"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReferralCodeCardProps = {
  initialCode: string | null;
};

export default function ReferralCodeCard({ initialCode }: ReferralCodeCardProps) {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/consumer/referrals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error || "Failed to generate referral code.");
        return;
      }
      setCode(payload?.referral?.referral_code || payload?.referralCode || null);
      setMessage("Referral code generated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate referral code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted">Referral code</div>
      {code ? (
        <div className="mt-2 text-lg font-semibold text-white">{code}</div>
      ) : (
        <p className="text-sm text-muted mt-2">
          Generate a code to invite friends and earn points.
        </p>
      )}
      <div className="mt-3">
        {!code ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? "Generating..." : "Generate code"}
          </button>
        ) : (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              navigator.clipboard?.writeText(code);
              setMessage("Copied to clipboard.");
            }}
          >
            Copy code
          </button>
        )}
      </div>
      {message && <p className="text-xs text-accent mt-2">{message}</p>}
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
