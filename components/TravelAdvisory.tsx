"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "ghd_travel_advisory_dismissed";

export default function TravelAdvisory() {
  const [mismatch, setMismatch] = useState<{ profileState: string; travelState: string } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const wasDismissed = sessionStorage.getItem(DISMISS_KEY);
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    fetch("/api/user/state")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { profileState: string | null; travelState: string | null } | null) => {
        if (
          data?.profileState &&
          data?.travelState &&
          data.profileState !== data.travelState
        ) {
          setMismatch({ profileState: data.profileState, travelState: data.travelState });
        }
      })
      .catch(() => undefined);
  }, []);

  if (dismissed || !mismatch) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4"
    >
      <div className="rounded-xl border border-yellow-500/40 bg-[#1a1c0e]/95 backdrop-blur p-4 shadow-xl text-sm text-yellow-200 flex gap-3 items-start">
        <span className="text-xl leading-none mt-0.5">✈️</span>
        <div className="flex-1">
          <p className="font-semibold mb-1">Looks like you&apos;re traveling</p>
          <p className="text-yellow-200/80 text-xs">
            Your account is registered in <strong>{mismatch.profileState}</strong>, but we detect
            you&apos;re currently in <strong>{mismatch.travelState}</strong>. Some products may not
            be available for delivery to your current location.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss travel advisory"
          className="text-yellow-200/60 hover:text-yellow-200 transition shrink-0 text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}
