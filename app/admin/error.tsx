"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminError({ error, reset }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    console.error("[AdminError] exception in admin section", {
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
            <h1 className="text-3xl font-bold text-red-400">Admin error</h1>
            <p className="text-muted">
              An error occurred in the admin panel. This has been logged.
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
              <Link href="/" className="btn-secondary">
                Back to homepage
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
