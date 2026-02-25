"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function VendorError({ error, reset }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    console.error("[VendorError] exception in vendor section", {
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
              We ran into a problem in your vendor portal. Please try again or contact support.
            </p>
            {process.env.NODE_ENV !== "production" && (
              <div className="text-xs text-muted space-y-1">
                <div>{error.message || "Unknown error"}</div>
                <div>Path: {pathname}</div>
              </div>
            )}
            <div className="flex gap-3 flex-wrap">
              <button type="button" onClick={reset} className="btn-primary">
                Try again
              </button>
              <Link href="/vendors/dashboard" className="btn-secondary">
                Back to dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
