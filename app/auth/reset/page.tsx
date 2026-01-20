"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import Footer from "@/components/Footer";

// Force dynamic rendering - this page requires client-side session handling
export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // Handle hash-based tokens (fallback for older Supabase flows)
  useEffect(() => {
    const handleHashTokens = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        try {
          const supabase = createSupabaseBrowserClient();
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            setError("Invalid reset link. Please request a new password reset.");
            return;
          }

          setSessionReady(true);
          // Clean up hash from URL
          window.history.replaceState(null, "", window.location.pathname);
        } catch (err) {
          setError("Failed to process reset link. Please request a new password reset.");
        }
      } else {
        // Check if we already have a session (from callback route)
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionReady(true);
        } else {
          // No session and no hash tokens - redirect to login
          router.push("/login?error=no_session");
        }
      }
    };

    handleHashTokens();
  }, [router]);

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
      
      // Redirect to login with success message
      setTimeout(() => {
        router.push("/login?message=password_reset_success");
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  };

  if (!sessionReady) {
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
