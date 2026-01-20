"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import Footer from "@/components/Footer";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Handle token exchange on mount
  useEffect(() => {
    const initializeSession = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        
        // Check URL for tokens (query params or hash)
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        
        const accessToken = urlParams.get("access_token") || hashParams.get("access_token");
        const refreshToken = urlParams.get("refresh_token") || hashParams.get("refresh_token");
        const type = urlParams.get("type") || hashParams.get("type");

        // Only proceed if this is a recovery token
        if (type !== "recovery") {
          if (!accessToken && !refreshToken) {
            // Check if we already have a valid session
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              setSessionReady(true);
              setInitializing(false);
              return;
            }
          }
          
          // Not a recovery token and no existing session
          setError("Invalid reset link. This link is not for password recovery.");
          setInitializing(false);
          return;
        }

        // If we have tokens, exchange them for a session
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            setError("Invalid or expired reset link. Please request a new password reset.");
            setInitializing(false);
            return;
          }

          // Clean up tokens from URL
          window.history.replaceState(null, "", window.location.pathname);
        }

        // Verify we have a session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionReady(true);
        } else {
          setError("No active session found. Please use the link from your password reset email.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to process reset link. Please request a new password reset.");
      } finally {
        setInitializing(false);
      }
    };

    initializeSession();
  }, []);

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

  if (initializing) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="max-w-2xl mx-auto surface-card p-8 text-center">
              <div className="mb-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
              </div>
              <p className="text-muted">Verifying reset link...</p>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen text-white flex flex-col">
        <main className="flex-1">
          <section className="section-shell">
            <div className="max-w-2xl mx-auto surface-card p-8 space-y-6">
              <div>
                <h1 className="text-4xl font-bold mb-4 text-accent">Password Reset</h1>
                {error && (
                  <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 text-red-400 mb-4">
                    {error}
                  </div>
                )}
                <p className="text-muted mb-4">
                  {error 
                    ? "Please request a new password reset link from the login page."
                    : "Unable to verify your reset link. Please use the link from your email."}
                </p>
                <Link href="/login" className="btn-primary inline-block">
                  Back to Login
                </Link>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
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
        </section>
      </main>
      <Footer />
    </div>
  );
}
