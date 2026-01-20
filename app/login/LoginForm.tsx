"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        setMessage("Login successful! Redirecting...");
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-2">
          Email
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
          placeholder="your@email.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-2">
          Password
        </label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Signing in..." : "Sign In"}
      </button>

      <div className="text-center text-sm text-muted">
        <button
          type="button"
          onClick={() => setShowForgotPassword(!showForgotPassword)}
          className="text-accent hover:underline mb-4"
        >
          Forgot password?
        </button>
        {showForgotPassword && (
          <div className="mt-4 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
            <p className="text-sm mb-3">Enter your email to receive a password reset link.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!email) {
                  setError("Please enter your email address");
                  return;
                }
                setResetLoading(true);
                setError(null);
                setMessage(null);

                try {
                  const supabase = createSupabaseBrowserClient();
                  const origin = window.location.origin;
                  const redirectTo = `${origin}/auth/callback?next=/auth/reset`;

                  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo,
                  });

                  if (resetError) {
                    setError(resetError.message);
                    setResetLoading(false);
                    return;
                  }

                  setMessage("Password reset email sent! Check your inbox and click the link to reset your password.");
                  setShowForgotPassword(false);
                  setResetLoading(false);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed to send reset email");
                  setResetLoading(false);
                }
              }}
              className="space-y-3"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
              />
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetLoading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          </div>
        )}
        <p className="mb-2 mt-4">Don't have an account?</p>
        <Link href="/signup" className="text-accent hover:underline">
          Sign up here
        </Link>
      </div>
    </form>
  );
}
