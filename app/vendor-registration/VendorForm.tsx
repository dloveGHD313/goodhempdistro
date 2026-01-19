"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getIntoxicatingCutoffDate } from "@/lib/compliance";

export default function VendorForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [coaAttested, setCoaAttested] = useState(false);
  const [intoxicatingAck, setIntoxicatingAck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [debugResponse, setDebugResponse] = useState<any>(null);
  const [isDebugMode, setIsDebugMode] = useState(false);

  // Check if debug mode is enabled
  useEffect(() => {
    setIsDebugMode(searchParams?.get("debug") === "1");
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent duplicate submissions
    if (loading || submitted) {
      return;
    }
    
    setLoading(true);
    setSubmitted(true);
    setError(null);
    setDebugResponse(null);

    try {
      // Build headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add debug key header if in debug mode
      if (isDebugMode) {
        const debugKey = typeof window !== "undefined" ? localStorage.getItem("DEBUG_KEY") : null;
        if (debugKey) {
          headers["x-debug-key"] = debugKey;
        }
      }

      // Build URL with debug param if enabled
      let url = "/api/vendors/create";
      if (isDebugMode) {
        url += "?debug=1";
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          business_name: businessName,
          description,
          coa_attested: coaAttested,
          intoxicating_policy_ack: intoxicatingAck,
        }),
      });

      const data = await response.json();

      // Store full response for debug mode
      if (isDebugMode) {
        setDebugResponse(data);
      }

      if (!response.ok) {
        // Show detailed error message
        const errorMsg = data.error || "Failed to create vendor";
        
        // Show build marker if present
        let fullErrorMsg = errorMsg;
        if (data.build_marker) {
          fullErrorMsg += `\n[Build: ${data.build_marker}]`;
        }
        
        // Show debug info if available
        if (data.debug) {
          fullErrorMsg += `\n\nDebug Info:\n${JSON.stringify(data.debug, null, 2)}`;
        }
        
        setError(fullErrorMsg);
        setLoading(false);
        setSubmitted(false); // Allow retry
        return;
      }

      // Show pending message
      if (data.application?.status === "pending") {
        router.push("/vendor-registration?status=pending");
        router.refresh();
      } else {
        // If somehow approved immediately, go to dashboard
        router.push("/vendors/dashboard");
        router.refresh();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      setLoading(false);
      setSubmitted(false); // Allow retry
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 surface-card p-8 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-accent">Create Your Vendor Account</h2>
      
      {error && (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
          <div className="font-semibold mb-2">Failed to submit vendor application</div>
          <div className="text-sm whitespace-pre-wrap font-mono text-xs">{error}</div>
        </div>
      )}

      {isDebugMode && debugResponse && (
        <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-4 text-blue-400">
          <div className="font-semibold mb-2">Debug Response (Full JSON)</div>
          <pre className="text-xs overflow-auto max-h-96 bg-black/30 p-2 rounded">
            {JSON.stringify(debugResponse, null, 2)}
          </pre>
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
        disabled={loading || submitted}
        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Submitting..." : submitted ? "Submitted" : "Create Vendor Account"}
      </button>

      <p className="text-sm text-muted text-center">
        Already have a vendor account? <Link href="/vendors/dashboard" className="text-accent hover:underline">Go to Dashboard</Link>
      </p>
    </form>
  );
}
