"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const intents = [
  { label: "Shop local drops", href: "/products", helper: "Find verified products near you." },
  { label: "Explore the feed", href: "/newsfeed", helper: "See VIP vendors + community updates." },
  { label: "Check compliance", href: "/blog", helper: "Quick compliance briefs and COA guidance." },
  { label: "Start onboarding", href: "/get-started", helper: "Join as a consumer or vendor." },
  { label: "Apply to drive", href: "/driver-apply", helper: "Earn with local deliveries." },
];

export default function MascotAssistant() {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsOpen(false);
    }, 9000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="mascot-shell">
      {isOpen && (
        <div className="mascot-panel card-glass">
          <div className="mascot-header">
            <div className="mascot-avatar">🪴</div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-muted">Hempster AI</p>
              <h3 className="text-lg font-semibold text-accent">Welcome to Good Hemp</h3>
              <p className="text-sm text-muted">
                Tell me what you want to do, and I will guide you to the right flow.
              </p>
            </div>
          </div>
          <div className="mascot-intents">
            {intents.map((intent) => (
              <Link key={intent.href} href={intent.href} className="mascot-intent">
                <span className="font-semibold">{intent.label}</span>
                <span className="text-xs text-muted">{intent.helper}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className="mascot-bubble"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open Hempster AI assistant"
      >
        <span className="mascot-bubble-icon">🪴</span>
        <span className="mascot-bubble-text">Ask Hempster</span>
      </button>
    </div>
  );
}
