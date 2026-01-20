"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";

type Props = {
  initialEmail?: string | null;
};

export default function ResetPasswordClient({ initialEmail }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState(initialEmail || "");
  const [resendLoading, setResendLoading] = useState(false);

  // Handle token exchange on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        
        // Check URL for code (PKCE flow)
        const code = searchParams.get("code");
        
        // Check URL hash for tokens (legacy flow)
        const hash = window.location.hash;
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");
        const errorCode = hashParams.get("error_code");
        const errorDescription = hashParams.get("error_description");

        console.log("[reset-password] Initializing session", {
          hasCode: !!code,
          hasHash: !!hash,
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          type,
          errorCode,
        });

        // Handle error in hash (e.g., otp_expired)
        if (errorCode) {
          console.warn(`[reset-password] Error in URL hash: ${errorCode} - ${errorDescription}`);
          if (errorCode === 'otp_expired' || errorCode === 'access_denied') {
            setError("This password reset link has expired or is invalid. Please request a new one.");
            setShowResend(true);
            setInitializing(false);
            return;
          }
        }

        // Handle PKCE flow (code-based)
        if (code) {
          console.log("[reset-password] Exchanging code for session (PKCE flow)");
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error("[reset-password] Code exchange error:", exchangeError);
            setError("Invalid or expired reset link. Please request a new password reset.");
            setShowResend(true);
            setInitializing(false);
            return;
          }

          if (data.session) {
            // Clean up code from URL
            window.history.replaceState(null, "", window.location.pathname);
            setSessionReady(true);
            setInitializing(false);
            return;
          }
        }

        // Handle hash-based flow (legacy)
        if (accessToken && refreshToken && type === "recovery") {
          console.log("[reset-password] Setting session from hash tokens (legacy flow)");
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error("[reset-password] Session error:", sessionError);
            setError("Invalid or expired reset link. Please request a new password reset.");
            setShowResend(true);
            setInitializing(false);
            return;
          }

          if (data.session) {
            // Clean up tokens from URL
            window.history.replaceState(null, "", window.location.pathname);
            setSessionReady(true);
            setInitializing(false);
            return;
          }
        }

        // Check if we already have a valid session (user navigated directly)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          console.log("[reset-password] Existing session found");
          setSessionReady(true);
          setInitializing(false);
          return;
        }

        // No valid session or tokens found - show friendly resend form (not hard error)
        console.log("[reset-password] No tokens or session found - showing resend form");
        setShowResend(true);
        setInitializing(false);
        // Don't set error - just show resend form with friendly message
      } catch (err) {
        console.error("[reset-password] Exception in initializeSession:", err);
        setError(err instanceof Error ? err.message : "Failed to process reset link. Please request a new password reset.");
        setShowResend(true);
        setInitializing(false);
      }
    };

    initializeSession();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      setLoading(false);
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      setMessage("Password updated successfully! Redirecting to login...");
      
      // Wait a moment to show success message, then redirect
      setTimeout(() => {
        router.push("/login?message=password_reset_success");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) {
      setError("Please enter your email address");
      return;
    }

    setResendLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.goodhempdistro.com';
      const redirectTo = `${origin}/reset-password`;

      console.log(`[reset-password] Resending reset email to ${resendEmail}, redirectTo=${redirectTo}`);

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resendEmail, {
        redirectTo,
      });

      if (resetError) {
        setError(resetError.message);
        setResendLoading(false);
        return;
      }

      setMessage("Password reset email sent! Check your inbox and click the link to reset your password.");
      setResendLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
      setResendLoading(false);
    }
  };

  if (initializing) {
    return (
      <div className="max-w-2xl mx-auto surface-card p-8 text-center">
        <div className="mb-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
        <p className="text-muted">Verifying reset link...</p>
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="max-w-2xl mx-auto surface-card p-8 space-y-6">
        <div>
          <h1 className="text-4xl font-bold mb-4 text-accent">Password Reset</h1>
          {error && (
            <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400 mb-4">
              {error}
            </div>
          )}
          {!error && (
            <p className="text-muted mb-4">
              Enter your email below to receive a password reset link.
            </p>
          )}
          {error && (
            <p className="text-muted mb-4">
              Please request a new password reset link below.
            </p>
          )}

          {showResend && (
            <div className="mt-6 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
              <p className="text-sm mb-3">Enter your email to receive a new password reset link.</p>
              <form onSubmit={handleResend} className="space-y-3">
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
                />
                <button
                  type="submit"
                  disabled={resendLoading}
                  className="w-full btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendLoading ? "Sending..." : "Resend Reset Link"}
                </button>
              </form>
            </div>
          )}

          <div className="mt-4">
            <Link href="/login" className="btn-primary inline-block">
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto surface-card p-8 space-y-6">
      <div>
        <h1 className="text-4xl font-bold mb-4 text-accent">Set New Password</h1>
        <p className="text-muted">
          Enter your new password below. Make sure it's at least 8 characters long.
        </p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {message && (
        <div className="bg-green-900/30 border border-green-600 rounded-lg p-4 text-green-400">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">
            New Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
            placeholder="Enter new password"
          />
          <p className="text-xs text-muted mt-1">Must be at least 8 characters</p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
            placeholder="Confirm new password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Updating Password..." : "Update Password"}
        </button>

        <div className="text-center text-sm text-muted">
          <Link href="/login" className="text-accent hover:underline">
            Back to Login
          </Link>
        </div>
      </form>
    </div>
  );
}
