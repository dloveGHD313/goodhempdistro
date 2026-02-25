"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RootError({ error, reset }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    console.error("[RootError] client-side exception", {
      message: error.message,
      digest: error.digest,
      pathname,
      stack: error.stack,
    });
  }, [error, pathname]);

  return (
    <div className="min-h-screen text-white flex flex-col">
      <main className="flex-1">
        <section className="section-shell">
          <div className="max-w-3xl mx-auto card-glass p-8 space-y-4">
            <h1 className="text-3xl font-bold text-accent">Something went wrong</h1>
            <p className="text-muted">
              We ran into a problem while loading this page. Please refresh and try again.
            </p>
            {process.env.NODE_ENV !== "production" && (
              <div className="text-xs text-muted space-y-1">
                <div>{error.message || "Unknown error"}</div>
                <div>Path: {pathname}</div>
              </div>
            )}
            <div className="flex gap-3">
              <button type="button" onClick={reset} className="btn-primary">
                Try again
              </button>
              {/* FIXED: Use Link for client-side nav instead of full-page reload */}
              <Link href="/" className="btn-secondary">
                Back to home
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
