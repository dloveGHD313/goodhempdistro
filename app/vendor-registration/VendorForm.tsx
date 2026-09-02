"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getIntoxicatingCutoffDate } from "@/lib/compliance";
import { getVendorReferralCode } from "@/lib/vendorReferral";
import TurnstileWidget from "@/components/TurnstileWidget";

export default function VendorForm() {
  const searchParams = useSearchParams();
  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [coaAttested, setCoaAttested] = useState(false);
  const [recreationalAck, setRecreationalAck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [debugResponse, setDebugResponse] = useState<any>(null);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [debugKeyExists, setDebugKeyExists] = useState(false);
  const [debugKeyPreview, setDebugKeyPreview] = useState("");
  const [sendingDebugHeader, setSendingDebugHeader] = useState(false);
  const [debugHeaderValue, setDebugHeaderValue] = useState("");
  const [responseHeaders, setResponseHeaders] = useState<{
    buildMarker?: string;
    requestId?: string;
  }>({});
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const supabaseModule = await import("@/lib/supabase");
        const createClient = supabaseModule.createSupabaseBrowserClient;
        if (typeof createClient !== "function") {
          if (isMounted) setAuthChecked(true);
          return;
        }
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (isMounted) {
          setUser(data.user ? { id: data.user.id } : null);
          setAuthChecked(true);
        }
      } catch {
        if (isMounted) setAuthChecked(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Check if debug mode is enabled
  useEffect(() => {
    const debugEnabled = searchParams?.get("debug") === "1";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDebugMode(debugEnabled);
    
    if (debugEnabled && typeof window !== "undefined") {
      const key = localStorage.getItem("DEBUG_KEY") || "";
      setDebugKeyExists(!!key);
      if (key) {
        setDebugKeyPreview(key.substring(0, 6) + "...");
        setDebugHeaderValue(key.substring(0, 6) + "...");
      } else {
        setDebugKeyPreview("");
        setDebugHeaderValue("");
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setShowLoginPrompt(true);
      return;
    }

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
      const debugKey = isDebugMode && typeof window !== "undefined" 
        ? localStorage.getItem("DEBUG_KEY") || "" 
        : "";
      
      if (isDebugMode) {
        headers["x-debug-key"] = debugKey;
        setSendingDebugHeader(true);
      }

      // Build URL with debug param if enabled
      const url = isDebugMode ? "/api/vendors/create?debug=1" : "/api/vendors/create";

      const response = await fetch(url, {
        method: "POST",
        headers,
        credentials: "include", // Explicitly send cookies
        body: JSON.stringify({
          business_name: businessName,
          description,
          coa_attested: coaAttested,
          intoxicating_policy_ack: recreationalAck,
          ...(getVendorReferralCode() ? { vr_code: getVendorReferralCode() } : {}),
          turnstileToken,
        }),
      });

      // Read response headers
      const buildMarker = response.headers.get("x-build-marker");
      const requestId = response.headers.get("x-request-id");
      if (isDebugMode) {
        setResponseHeaders({
          buildMarker: buildMarker || undefined,
          requestId: requestId || undefined,
        });
      }

      const data = await response.json();

      // Store full response for debug mode
      if (isDebugMode) {
        setDebugResponse(data);
      }

      if (!response.ok) {
        // Show detailed error message
        const errorMsg = data.error || "Failed to create vendor";
        
        // Build error message with marker/id/debug_status
        const parts: string[] = [errorMsg];
        if (data.build_marker && data.request_id && data.debug_status) {
          parts.push(`(${data.build_marker} / ${data.request_id} / ${data.debug_status.reason})`);
        }
        if (data.debug) {
          parts.push(`\n\nDebug Info:\n${JSON.stringify(data.debug, null, 2)}`);
        }
        
        setError(parts.join(" "));
        setLoading(false);
        setSubmitted(false); // Allow retry
        return;
      }

      // Redirect to activate: choose a plan to get vendor_status=active (Stripe webhook only)
      window.location.href = "/vendors/activate";
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      setLoading(false);
      setSubmitted(false); // Allow retry
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 surface-card p-8 max-w-2xl mx-auto">
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 max-w-sm w-full rounded-2xl border border-white/10 bg-[#0D1512] p-8 text-center">
            <h3 className="text-xl font-serif text-[#F0EDE6] mb-3">
              Create an account to continue
            </h3>
            <p className="text-sm text-[#8A9E96] mb-6">
              You need a free Good Hemp Distro account to submit your vendor application.
              It only takes a minute.
            </p>
            <div className="flex flex-col gap-3">
              <a
                href="/signup?redirect=/vendor-registration"
                className="w-full rounded-lg bg-[#3CB97A] px-6 py-3 text-sm font-semibold text-[#0D1512] hover:opacity-90 transition-opacity text-center block"
              >
                Create Free Account →
              </a>
              <a
                href="/login?redirect=/vendor-registration"
                className="w-full rounded-lg border border-white/10 px-6 py-3 text-sm text-[#8A9E96] hover:text-[#F0EDE6] transition-colors text-center block"
              >
                Already have an account? Sign in
              </a>
              <button
                type="button"
                onClick={() => setShowLoginPrompt(false)}
                className="text-xs text-[#8A9E96]/60 hover:text-[#8A9E96] mt-1"
              >
                Cancel — go back to form
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-6 text-accent">Create Your Vendor Account</h2>
      
      {/* Debug Panel - Visible when ?debug=1 */}
      {isDebugMode && (
        <div className="bg-yellow-900/30 border-2 border-yellow-600 rounded-lg p-4 text-yellow-300 mb-6">
          <div className="font-bold mb-3 text-lg">🔍 DEBUG MODE ENABLED</div>
          <div className="space-y-2 text-sm font-mono">
            <div><strong>Origin:</strong> {typeof window !== "undefined" ? window.location.origin : "N/A"}</div>
            <div><strong>URL has debug=1:</strong> {searchParams?.get("debug") === "1" ? "✅ YES" : "❌ NO"}</div>
            <div><strong>DEBUG_KEY in localStorage:</strong> {debugKeyExists ? "✅ YES" : "❌ NO"}</div>
            {debugKeyExists && (
              <div><strong>DEBUG_KEY Preview:</strong> {debugKeyPreview}</div>
            )}
            <div><strong>Sending x-debug-key header:</strong> {sendingDebugHeader ? "✅ YES" : "❌ NO"}</div>
            {sendingDebugHeader && debugHeaderValue && (
              <div><strong>Header value (first 6 chars):</strong> {debugHeaderValue}</div>
            )}
            {responseHeaders.buildMarker && (
              <div><strong>Response X-Build-Marker:</strong> {responseHeaders.buildMarker}</div>
            )}
            {responseHeaders.requestId && (
              <div><strong>Response X-Request-Id:</strong> {responseHeaders.requestId}</div>
            )}
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
              checked={recreationalAck}
              onChange={(e) => setRecreationalAck(e.target.checked)}
              required
              className="mt-1 w-4 h-4 accent-accent"
            />
            <span className="text-sm">
              I acknowledge recreational products are allowed only until {getIntoxicatingCutoffDate()} <span className="text-red-400">*</span>
            </span>
          </label>
        </div>
      </div>

      <TurnstileWidget action="vendor_registration" onToken={setTurnstileToken} />

      <button
        type="submit"
        disabled={loading || submitted || !authChecked}
        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Submitting..." : submitted ? "Submitted" : !authChecked ? "Loading..." : "Create Vendor Account"}
      </button>

      <p className="text-sm text-muted text-center">
        Already have a vendor account? <Link href="/vendors/dashboard" className="text-accent hover:underline">Go to Dashboard</Link>
      </p>
    </form>
  );
}
