"use client";

import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function OnboardingError({ error, reset }: Props) {
  useEffect(() => {
    console.error("[onboarding] client-side exception", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-3xl mx-auto card-glass p-8 space-y-4">
            <h1 className="text-3xl font-bold text-accent">Something went wrong</h1>
            <p className="text-muted">
              We had trouble loading onboarding. Please try again or start from the beginning.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={reset} className="btn-primary">
                Try again
              </button>
              <a href="/get-started" className="btn-secondary">
                Get started
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
