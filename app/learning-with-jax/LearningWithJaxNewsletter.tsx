"use client";

import { useState } from "react";

export default function LearningWithJaxNewsletter() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source: "learning-with-jax" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok === true) {
        setSubmitted(true);
      } else {
        setError(data?.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <p className="text-[var(--text)] font-medium">
        Thanks! We&apos;ll notify you when new episodes drop.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your email"
        required
        disabled={loading}
        className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-lime)] disabled:opacity-70"
        aria-label="Email for episode notifications"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "newsletter-error" : undefined}
      />
      <button
        type="submit"
        className="btn-primary shrink-0"
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? "Sending…" : "Notify me"}
      </button>
      {error && (
        <p id="newsletter-error" className="text-red-400 text-sm w-full mt-1" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
