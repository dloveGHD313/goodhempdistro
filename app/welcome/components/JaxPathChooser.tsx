"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import JaxFigure from "@/components/mascot/JaxFigure";
import { entryPaths, foundingVendorOffer, jaxHeroCopy, type EntryPathKey } from "@/lib/entryCopy";

export const INTENT_STORAGE_KEY = "ghd_intent";

/** Remember the visitor's chosen path so later pages can pick up the thread. */
export function rememberIntent(key: EntryPathKey) {
  try {
    window.localStorage.setItem(INTENT_STORAGE_KEY, JSON.stringify({ key, at: Date.now() }));
  } catch {
    // Storage can be unavailable (private mode, blocked) — the click still navigates.
  }
}

const ACCENT: Record<string, { ring: string; text: string; glow: string }> = {
  green: { ring: "border-[#3CB97A]/40 hover:border-[#3CB97A]", text: "text-[#3CB97A]", glow: "rgba(60,185,122,0.35)" },
  teal: { ring: "border-[#1FA6A8]/40 hover:border-[#1FA6A8]", text: "text-[#3FCFD1]", glow: "rgba(31,166,168,0.35)" },
  gold: { ring: "border-[#C9A84C]/40 hover:border-[#C9A84C]", text: "text-[#C9A84C]", glow: "rgba(201,168,76,0.35)" },
};

/**
 * JAX-guided first-visit onboarding: one question, three doors.
 * Server-renders fully visible (no mounted guard) so the LCP text paints
 * immediately; JS only adds the speech-bubble swap and intent memory.
 */
export default function JaxPathChooser() {
  const [active, setActive] = useState<EntryPathKey | null>(null);
  const activePath = entryPaths.find((p) => p.key === active) ?? null;
  const bubble = activePath ? activePath.jaxLine : jaxHeroCopy.idleLine;

  const onChoose = useCallback((key: EntryPathKey) => rememberIntent(key), []);

  return (
    <div className="w-full">
      {/* JAX + speech bubble */}
      <div className="flex flex-col md:flex-row items-center md:items-end justify-center gap-4 md:gap-8 mb-8 md:mb-10">
        <div className="ghd-float shrink-0">
          <JaxFigure outfit="welcome" width={150} showCaption={false} priority />
        </div>
        <div
          className="ghd-bubble relative max-w-md rounded-2xl border border-white/10 bg-[#141F1A]/90 backdrop-blur px-5 py-4 text-left"
          aria-live="polite"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-[#3CB97A] mb-1">JAX</p>
          <p className="text-[#F0EDE6] font-semibold leading-snug">{jaxHeroCopy.greeting}</p>
          <p key={bubble} className="ghd-bubble-line text-sm text-[#B7C6BF] mt-2 min-h-[2.5rem]">
            {bubble}
          </p>
        </div>
      </div>

      {/* Three doors */}
      <div className="grid gap-4 md:grid-cols-3" role="list" aria-label="Choose your path">
        {entryPaths.map((path, i) => {
          const a = ACCENT[path.accent];
          return (
            <Link
              key={path.key}
              role="listitem"
              href={path.href}
              onMouseEnter={() => setActive(path.key)}
              onFocus={() => setActive(path.key)}
              onMouseLeave={() => setActive(null)}
              onBlur={() => setActive(null)}
              onClick={() => onChoose(path.key)}
              className={`ghd-door group relative rounded-2xl border bg-[#141F1A]/80 p-6 text-left transition-all duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3CB97A] ${a.ring}`}
              style={{ ["--door-glow" as string]: a.glow, animationDelay: `${300 + i * 120}ms` }}
              data-path={path.key}
            >
              <p className={`text-xs uppercase tracking-[0.3em] mb-3 ${a.text}`}>{path.eyebrow}</p>
              <h3 className="text-2xl text-[#F0EDE6] font-serif mb-2">{path.title}</h3>
              <p className="text-sm text-[#8A9E96] mb-4">{path.body}</p>
              {path.key === "sell" && foundingVendorOffer.enabled ? (
                <p className="text-xs text-[#C9A84C] mb-4">{foundingVendorOffer.line}</p>
              ) : null}
              <span className={`inline-flex items-center gap-2 font-semibold ${a.text}`}>
                {path.cta}
                <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
