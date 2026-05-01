"use client";

import { useEffect, useState } from "react";

const VIEW_COUNT_KEY = "newsfeed_welcome_views";
const DISMISSED_KEY = "newsfeed_welcome_dismissed";
const MAX_VIEWS = 3;

type Props = {
  greeting: string;
  interests: string[];
};

function readNumber(key: string): number {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export default function WelcomeBannerDismiss({ greeting, interests }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      dismissed = false;
    }
    if (dismissed) return;

    const views = readNumber(VIEW_COUNT_KEY);
    if (views >= MAX_VIEWS) return;

    try {
      window.localStorage.setItem(VIEW_COUNT_KEY, String(views + 1));
    } catch {
      // continue even if storage fails
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
  }, []);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // continue even if storage fails
    }
    setVisible(false);
  };

  if (!visible) return null;

  const interestText =
    interests.length >= 2
      ? `${interests[0]} and ${interests[1]}`
      : interests.length === 1
        ? interests[0]
        : null;

  return (
    <section className="section-shell pt-6 pb-2">
      <div
        role="status"
        className="relative max-w-3xl mx-auto rounded-xl border border-[var(--brand-lime)]/30 bg-[var(--surface)]/60 backdrop-blur p-5 pr-12"
      >
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss welcome banner"
          className="absolute top-3 right-3 text-muted hover:text-white transition-colors text-lg leading-none"
        >
          ×
        </button>
        <p className="text-accent font-semibold mb-1">Welcome, {greeting}!</p>
        <p className="text-muted text-sm">
          {interestText
            ? `Based on your interests in ${interestText}, here's what we picked for you.`
            : "Here's what we picked for you, based on your onboarding answers."}
        </p>
      </div>
    </section>
  );
}
