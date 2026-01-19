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
  const [debugKeyExists, setDebugKeyExists] = useState(false);
  const [debugKeyPreview, setDebugKeyPreview] = useState("");
  const [sendingDebugHeader, setSendingDebugHeader] = useState(false);

  // Check if debug mode is enabled
  useEffect(() => {
    const debugEnabled = searchParams?.get("debug") === "1";
    setIsDebugMode(debugEnabled);
    
    if (debugEnabled && typeof window !== "undefined") {
      const key = localStorage.getItem("DEBUG_KEY");
      setDebugKeyExists(!!key);
      if (key) {
        setDebugKeyPreview(key.substring(0, 6) + "...");
      } else {
        setDebugKeyPreview("");
      }
    }
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

      // Always send x-debug-key header when in debug mode (even if empty)
      if (isDebugMode) {
        const debugKey = typeof window !== "undefined" ? localStorage.getItem("DEBUG_KEY") || "" : "";
        headers["x-debug-key"] = debugKey;
        setSendingDebugHeader(true);
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
        
        // Show build marker and request_id if present
        let fullErrorMsg = errorMsg;
        if (data.build_marker) {
          fullErrorMsg += `\n[Build: ${data.build_marker}]`;
        }
        if (data.request_id) {
          fullErrorMsg += `\n[Request ID: ${data.request_id}]`;
        }
        if (data.debug_status) {
          fullErrorMsg += `\n[Debug: ${data.debug_status.enabled ? "ON" : "OFF"} - ${data.debug_status.reason}]`;
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
      
      {/* Debug Panel - Visible when ?debug=1 */}
      {isDebugMode && (
        <div className="bg-yellow-900/30 border-2 border-yellow-600 rounded-lg p-4 text-yellow-300">
          <div className="font-bold mb-3 text-lg">🔍 DEBUG MODE ENABLED</div>
          <div className="space-y-2 text-sm font-mono">
            <div><strong>Origin:</strong> {typeof window !== "undefined" ? window.location.origin : "N/A"}</div>
            <div><strong>DEBUG_KEY in localStorage:</strong> {debugKeyExists ? "✅ YES" : "❌ NO"}</div>
            {debugKeyExists && (
              <div><strong>DEBUG_KEY Preview:</strong> {debugKeyPreview}</div>
            )}
            <div><strong>Sending x-debug-key header:</strong> {sendingDebugHeader ? "✅ YES" : "❌ NO"}</div>
            {!debugKeyExists && (
              <div className="mt-3 p-2 bg-red-900/50 border border-red-600 rounded text-red-200">
                ⚠️ WARNING: DEBUG_KEY missing in localStorage for this origin.<br/>
                Run in console: <code className="bg-black/50 px-1 rounded">localStorage.setItem('DEBUG_KEY', 'your-key-value')</code>
              </div>
            )}
          </div>
          {debugResponse && (
            <div className="mt-4 pt-4 border-t border-yellow-600/50">
              <div className="font-semibold mb-2">Last Response JSON:</div>
              <pre className="text-xs overflow-auto max-h-96 bg-black/50 p-3 rounded border border-yellow-600/30">
                {JSON.stringify(debugResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
          <div className="font-semibold mb-2">Failed to submit vendor application</div>
          <div className="text-sm whitespace-pre-wrap font-mono text-xs">{error}</div>
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
