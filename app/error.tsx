"use client";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RootError({ error, reset }: Props) {
  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-3xl mx-auto card-glass p-8 space-y-4">
            <h1 className="text-3xl font-bold text-accent">Something went wrong</h1>
            <p className="text-muted">
              We hit an unexpected issue while loading this page. Please try again.
            </p>
            {process.env.NODE_ENV !== "production" && (
              <div className="text-xs text-muted">
                {error.message || "Unknown error"}
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={reset} className="btn-primary">
                Try again
              </button>
              <a href="/" className="btn-secondary">
                Back to home
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
