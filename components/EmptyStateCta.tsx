"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  isLoggedIn: boolean;
  /** e.g. "Create Group" or "Create Topic" */
  createLabel: string;
  /** If provided and route exists, use as href; otherwise show Coming Soon. */
  createHref?: string | null;
};

/**
 * Empty-state CTAs: when logged out show Sign in / Get Started;
 * when logged in show create action (link if createHref, else Coming Soon modal).
 */
export default function EmptyStateCta({ isLoggedIn, createLabel, createHref }: Props) {
  const [showComingSoon, setShowComingSoon] = useState(false);

  if (isLoggedIn) {
    if (createHref) {
      return (
        <div className="flex gap-3 flex-wrap">
          <Link href={createHref} className="btn-primary">
            {createLabel}
          </Link>
        </div>
      );
    }
    return (
      <>
        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setShowComingSoon(true)}
            className="btn-primary"
          >
            {createLabel}
          </button>
        </div>
        {showComingSoon && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setShowComingSoon(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Coming soon"
          >
            <div
              className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 max-w-sm mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="font-semibold text-[var(--fg)]">Coming soon</p>
              <p className="text-sm text-[var(--muted)] mt-2">
                {createLabel} will be available in a future update.
              </p>
              <button
                type="button"
                onClick={() => setShowComingSoon(false)}
                className="btn-primary mt-4 w-full"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex gap-3 flex-wrap">
      <Link href="/login" className="btn-primary">
        Sign in
      </Link>
      <Link href="/get-started" className="btn-secondary">
        Get Started
      </Link>
    </div>
  );
}
