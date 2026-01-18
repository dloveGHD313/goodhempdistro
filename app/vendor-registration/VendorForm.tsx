"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getIntoxicatingCutoffDate } from "@/lib/compliance";

export default function VendorForm() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [coaAttested, setCoaAttested] = useState(false);
  const [intoxicatingAck, setIntoxicatingAck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/vendors/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: businessName,
          description,
          coa_attested: coaAttested,
          intoxicating_policy_ack: intoxicatingAck,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create vendor");
        setLoading(false);
        return;
      }

      // Redirect to vendor dashboard
      router.push("/vendors/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 surface-card p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-accent">Create Your Vendor Account</h2>
      
      {error && (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="business_name" className="block text-sm font-medium mb-2">
          Business Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          id="business_name"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          required
          className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
          placeholder="Your Business Name"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-2">
          Description (Optional)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
          placeholder="Tell us about your business..."
        />
      </div>

      <div className="space-y-4 border-t border-[var(--border)] pt-6">
        <h3 className="text-lg font-semibold">Compliance Requirements</h3>
        
        <div className="space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={coaAttested}
              onChange={(e) => setCoaAttested(e.target.checked)}
              required
              className="mt-1 w-4 h-4 accent-accent"
            />
            <span className="text-sm">
              I attest I will upload FULL PANEL COAs for all products <span className="text-red-400">*</span>
            </span>
          </label>
        </div>

        <div className="space-y-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={intoxicatingAck}
              onChange={(e) => setIntoxicatingAck(e.target.checked)}
              required
              className="mt-1 w-4 h-4 accent-accent"
            />
            <span className="text-sm">
              I acknowledge intoxicating products are allowed only until {getIntoxicatingCutoffDate()} <span className="text-red-400">*</span>
            </span>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Creating..." : "Create Vendor Account"}
      </button>

      <p className="text-sm text-muted text-center">
        Already have a vendor account? <Link href="/vendors/dashboard" className="text-accent hover:underline">Go to Dashboard</Link>
      </p>
    </form>
  );
}
