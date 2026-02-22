"use client";

import { useState } from "react";

export default function LearningWithJaxNewsletter() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
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
        className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-lime)]"
        aria-label="Email for episode notifications"
      />
      <button type="submit" className="btn-primary shrink-0">
        Notify me
      </button>
    </form>
  );
}
