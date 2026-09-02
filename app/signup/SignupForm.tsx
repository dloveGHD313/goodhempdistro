"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { isSafeNextPath } from "@/lib/phase2-workout-flow";
import { HONEYPOT_FIELD, emailSpamVerdict, nowMs, submittedTooFast } from "@/lib/server/antiSpam";
import TurnstileWidget from "@/components/TurnstileWidget";

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? undefined;
  const role = searchParams.get("role") ?? undefined;
  const callbackPath = "/auth/callback";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  // Cloudflare Turnstile token — forwarded to Supabase Auth, which verifies it
  // server-side once "Bot and Abuse Protection" is enabled in the dashboard.
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const mountedAtRef = useRef(0);
  useEffect(() => {
    mountedAtRef.current = nowMs();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    // Bot gate: filled honeypot or an instant submit gets a silent "success";
    // spammy email patterns get a generic error with no detail to learn from.
    if (honeypot.trim().length > 0 || submittedTooFast(mountedAtRef.current)) {
      console.warn("[signup] blocked bot submission");
      setMessage("Check your email to confirm your account.");
      setLoading(false);
      return;
    }
    if (emailSpamVerdict(email).block) {
      setError("Please use a regular, non-disposable email address.");
      setLoading(false);
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const url = new URL(origin + callbackPath);
      if (next && isSafeNextPath(next)) url.searchParams.set("next", next);
      if (role) url.searchParams.set("role", role);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: url.toString(),
          ...(captchaToken ? { captchaToken } : {}),
        },
      });

      if (signUpError) {
        const correlationId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ref-${nowMs()}`;
        console.warn("[signup] auth error", { code: signUpError.name, message: signUpError.message.slice(0, 200), correlationId });
        const friendlyMessage = signUpError.message?.includes("Database") || signUpError.message?.includes("saving new user")
          ? `Something went wrong creating your account. Please try again or contact support. Reference: ${correlationId}`
          : signUpError.message;
        setError(friendlyMessage);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Check if email confirmation is required
        if (data.session) {
          // User is immediately logged in (email confirmation disabled) — always use post-login-route so onboarding gating applies
          if (role) {
            await fetch("/api/auth/set-role", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role }),
              credentials: "include",
            });
          }
          const res = await fetch("/api/auth/post-login-route", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ next: next ?? undefined, workoutPath: role ?? undefined, role: role ?? undefined }),
            credentials: "include",
          });
          const { redirectTo } = (await res.json()) as { redirectTo: string };
          router.push(redirectTo ?? "/onboarding");
        } else {
          // Email confirmation required — preserve next/role so callback or login can use them
          setMessage("Check your email to confirm your account.");
          const loginUrl = new URL(origin + "/login");
          if (next && isSafeNextPath(next)) loginUrl.searchParams.set("next", next);
          if (role) loginUrl.searchParams.set("role", role);
          loginUrl.searchParams.set("confirm", "1");
          setTimeout(() => {
            router.push(loginUrl.pathname + loginUrl.search);
          }, 5000);
        }
      }
    } catch (err) {
      const correlationId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ref-${nowMs()}`;
      console.warn("[signup] exception", err, { correlationId });
      setError(`Something went wrong. Please try again or contact support. Reference: ${correlationId}`);
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", top: "-9999px", width: 0, height: 0, overflow: "hidden" }}
      >
        <label htmlFor={HONEYPOT_FIELD}>Company website</label>
        <input
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
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
          minLength={6}
          className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
          placeholder="••••••••"
        />
        <p className="text-xs text-muted mt-1">Must be at least 6 characters</p>
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
          minLength={6}
          className="w-full px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-white"
          placeholder="••••••••"
        />
      </div>

      <TurnstileWidget action="signup" onToken={setCaptchaToken} />

      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Creating account..." : "Sign Up"}
      </button>

      <div className="text-center text-sm text-muted">
        <p className="mb-2">Already have an account?</p>
        <Link
          href={
            next || role
              ? `/login?${new URLSearchParams({
                  ...(next && isSafeNextPath(next) && { next }),
                  ...(role && { role }),
                }).toString()}`
              : "/login"
          }
          className="text-accent hover:underline"
        >
          Sign in here
        </Link>
      </div>
    </form>
  );
}
