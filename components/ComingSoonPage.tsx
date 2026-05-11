"use client";

import { useState } from "react";
import Link from "next/link";
import Footer from "@/components/Footer";

type Props = {
  /** Short eyebrow text above the headline, e.g. "Coming Soon" */
  eyebrow: string;
  /** The page H1 */
  headline: string;
  /** One-line value proposition under the headline */
  valueProp: string;
  /** Email-capture source tag (stored in newsletter_signups.source) */
  source: string;
  /** Optional secondary CTA below the form (link to an existing page) */
  secondaryCta?: { label: string; href: string };
};

export default function ComingSoonPage({
  eyebrow,
  headline,
  valueProp,
  source,
  secondaryCta,
}: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setStatus("error");
        setErrorMessage(data?.error || "Signup failed. Please try again.");
        return;
      }
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0D1512] text-[#F0EDE6]">
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-xl w-full text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-[#3CB97A] mb-3">
            {eyebrow}
          </p>
          <div className="mx-auto h-px w-16 bg-[#3CB97A]/40 mb-8" aria-hidden="true" />

          <h1 className="text-3xl sm:text-4xl font-serif mb-5">{headline}</h1>

          <p className="text-base text-[#8A9E96] leading-relaxed mb-10">{valueProp}</p>

          {status === "success" ? (
            <div
              role="status"
              className="rounded-lg border border-[#3CB97A]/30 bg-[#3CB97A]/10 px-5 py-4 text-sm text-[#3CB97A]"
            >
              You&apos;re on the list. We&apos;ll email you as soon as this is ready.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-4">
              <label htmlFor={`coming-soon-email-${source}`} className="sr-only">
                Email address
              </label>
              <input
                id={`coming-soon-email-${source}`}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={status === "submitting"}
                className="flex-1 rounded-lg border border-white/15 bg-[#0D1512]/60 px-4 py-3 text-sm text-[#F0EDE6] placeholder:text-[#8A9E96]/60 focus:border-[#3CB97A] focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status === "submitting"}
                className="rounded-lg bg-[#3CB97A] px-5 py-3 text-sm font-semibold text-[#0D1512] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {status === "submitting" ? "Submitting…" : "Notify me"}
              </button>
            </form>
          )}

          {status === "error" && errorMessage && (
            <p role="alert" className="text-sm text-red-400 mb-4">
              {errorMessage}
            </p>
          )}

          {secondaryCta && (
            <Link
              href={secondaryCta.href}
              className="inline-block text-sm text-[#8A9E96] hover:text-[#F0EDE6] transition-colors underline-offset-4 hover:underline"
            >
              {secondaryCta.label}
            </Link>
          )}

          <p className="mt-12 text-xs text-[#8A9E96]/60 leading-relaxed">
            FDA disclaimer: These statements have not been evaluated by the FDA.
            Hemp products are not intended to diagnose, treat, cure, or prevent any disease.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
