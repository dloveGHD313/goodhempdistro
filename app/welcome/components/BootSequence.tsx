"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import JaxFigure from "@/components/mascot/JaxFigure";
import { setWelcomeProfile } from "@/lib/phase0-storage";
import type { PlatformStats } from "@/lib/server/platformStats";
import {
  BOOT_SEEN_KEY,
  jaxLineFor,
  primaryIntent,
  signupRoleFor,
  welcomeGate,
  welcomeIntentCards,
  type IntentAccent,
} from "@/lib/welcomeIntents";
import { rememberIntent } from "./JaxPathChooser";

type Phase = "boot" | "jax" | "cards" | "leaving";

type Props = {
  stats: PlatformStats | null;
  /** Signed-in visitors never see the boot sequence (they've onboarded). */
  isAuthenticated: boolean;
};

const ACCENT: Record<IntentAccent, { ring: string; text: string; glow: string; fill: string }> = {
  green: { ring: "border-[#3CB97A]/35", text: "text-[#3CB97A]", glow: "rgba(60,185,122,0.45)", fill: "rgba(60,185,122,0.14)" },
  gold: { ring: "border-[#C9A84C]/35", text: "text-[#C9A84C]", glow: "rgba(201,168,76,0.45)", fill: "rgba(201,168,76,0.14)" },
  teal: { ring: "border-[#1FA6A8]/35", text: "text-[#3FCFD1]", glow: "rgba(31,166,168,0.45)", fill: "rgba(31,166,168,0.14)" },
  violet: { ring: "border-[#8B7CF6]/35", text: "text-[#A89CFF]", glow: "rgba(139,124,246,0.45)", fill: "rgba(139,124,246,0.14)" },
};

/** Inline, pre-hydration guard: hide the overlay before first paint for returning visitors. */
const PRE_HYDRATION_GUARD = `try{if(localStorage.getItem(${JSON.stringify(BOOT_SEEN_KEY)})||/[?&](intent|noboot)=/.test(location.search)){document.documentElement.classList.add('ghd-boot-off')}}catch(e){}`;

function bootLines(stats: PlatformStats | null): string[] {
  const lines = ["GOOD HEMP DISTROS", "SYSTEM ONLINE"];
  if (stats) {
    if (stats.categories && stats.categories > 0) lines.push(`${stats.categories} hemp categories indexed`);
    if (stats.activeVendors && stats.activeVendors > 0)
      lines.push(`${stats.activeVendors} founding vendor${stats.activeVendors === 1 ? "" : "s"} verified`);
    if (stats.liveProducts && stats.liveProducts > 0)
      lines.push(`${stats.liveProducts} product${stats.liveProducts === 1 ? "" : "s"} live`);
    if (stats.publishedEpisodes && stats.publishedEpisodes > 0)
      lines.push(`${stats.publishedEpisodes} Learning with JAX episode${stats.publishedEpisodes === 1 ? "" : "s"} ready`);
  }
  lines.push("COA registry: required where the law requires it");
  lines.push("Loading JAX…");
  return lines;
}

/**
 * Phase 0 boot sequence — the roadmap's "futuristic app-OS boot-up meets movie
 * trailer" entry. Plays once per visitor (localStorage flag), never for
 * signed-in users, never when ?intent= or ?noboot= is present (deep links,
 * Lighthouse). Reduced-motion visitors go straight to the question.
 *
 * Flow: boot ticker → JAX enters and asks why you're here → nine intent cards
 * pop in one after another → multi-select (Continue disabled until ≥1) → JAX
 * reacts to each pick with a role-specific line → Continue stores the intents
 * (lib/phase0-storage, later persisted to profiles.welcome_intents by
 * PersistWelcomeIntents after auth) and hands off to /signup → /onboarding.
 */
export default function BootSequence({ stats, isAuthenticated }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(true);
  const [phase, setPhase] = useState<Phase>("boot");
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [lastToggled, setLastToggled] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  const firstCardRef = useRef<HTMLButtonElement | null>(null);
  const lines = useMemo(() => bootLines(stats), [stats]);

  // Decide once, on the client, whether this visitor gets the sequence.
  // Scheduled on the next frame so the decision never races hydration.
  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      let seen = false;
      try {
        seen = !!window.localStorage.getItem(BOOT_SEEN_KEY);
      } catch {
        seen = false;
      }
      const deepLink = searchParams?.has("intent") || searchParams?.has("noboot");
      const prefersReduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      setMounted(true);
      if (isAuthenticated || seen || deepLink) {
        setShow(false);
        return;
      }
      setReduced(prefersReduced);
      if (prefersReduced) setPhase("cards");
    });
    return () => window.cancelAnimationFrame(raf);
  }, [isAuthenticated, searchParams]);

  // Lock the page behind the overlay while it's up.
  useEffect(() => {
    if (!mounted || !show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted, show]);

  // Boot ticker → JAX → cards.
  useEffect(() => {
    if (!mounted || !show || reduced) return;
    if (phase !== "boot") return;
    if (tick < lines.length) {
      const t = setTimeout(() => setTick((n) => n + 1), tick === 0 ? 350 : 190);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setPhase("jax"), 420);
    return () => clearTimeout(t);
  }, [mounted, show, reduced, phase, tick, lines.length]);

  useEffect(() => {
    if (phase !== "jax") return;
    const t = setTimeout(() => setPhase("cards"), 1100);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase === "cards") {
      const t = setTimeout(() => firstCardRef.current?.focus({ preventScroll: true }), 700);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const toggle = useCallback((key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setLastToggled(key);
  }, []);

  const finish = useCallback(
    (skip: boolean) => {
      try {
        window.localStorage.setItem(BOOT_SEEN_KEY, String(Date.now()));
      } catch {
        // storage unavailable — the hand-off still works
      }
      if (skip) {
        setPhase("leaving");
        setTimeout(() => setShow(false), 450);
        return;
      }
      setWelcomeProfile({ intents: selected });
      const primary = primaryIntent(selected);
      if (primary === "shop" || primary === "business") rememberIntent("shop");
      else if (primary === "industrial") rememberIntent("build");
      else if (primary === "sell" || primary === "services" || primary === "events") rememberIntent("sell");
      setPhase("leaving");
      const role = signupRoleFor(selected);
      const target = isAuthenticated
        ? "/onboarding"
        : `/signup?next=${encodeURIComponent("/onboarding")}${role ? `&role=${role}` : ""}`;
      setTimeout(() => router.push(target), 420);
    },
    [selected, isAuthenticated, router]
  );

  const jaxLine = jaxLineFor(selected, lastToggled);
  const canContinue = selected.length > 0;

  const overlay = show ? (
        <div
          className={`ghd-boot fixed inset-0 z-[200] flex flex-col overflow-y-auto overflow-x-hidden bg-[#070B09] text-[#F0EDE6] ${
            phase === "leaving" ? "ghd-boot-leave" : ""
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to Good Hemp Distro"
          data-phase={phase}
        >
          <div className="ghd-aurora" aria-hidden />
          <div className="ghd-grain" aria-hidden />
          <div className="ghd-boot-scan" aria-hidden />

          {/* ── Phase A: boot ticker ── */}
          {phase === "boot" ? (
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6">
              <p className="ghd-boot-mark text-[11px] uppercase tracking-[0.6em] text-[#3CB97A]">The hemp industry platform</p>
              <h1 className="ghd-boot-title mt-4 font-serif text-4xl md:text-6xl text-center">
                <span className="ghd-shimmer">Good Hemp Distros</span>
              </h1>
              <ol className="ghd-boot-ticker mt-8 w-full max-w-md font-mono text-xs md:text-sm text-[#8A9E96]" aria-live="polite">
                {lines.slice(0, tick).map((l, i) => (
                  <li key={l} className="ghd-boot-line flex items-center gap-3 py-1" style={{ animationDelay: `${i * 20}ms` }}>
                    <span className="ghd-boot-dot h-1.5 w-1.5 rounded-full bg-[#3CB97A]" aria-hidden />
                    <span>{l}</span>
                    <span className="ml-auto text-[#3CB97A]/70">ok</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {/* ── Phase B + C: JAX asks, cards answer ── */}
          {phase !== "boot" ? (
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8 md:px-8">
              <div className="ghd-boot-jax flex w-full max-w-5xl flex-col items-center gap-4 md:flex-row md:items-end md:justify-center md:gap-8">
                <div className="ghd-float shrink-0">
                  <div className={phase === "jax" ? "w-[150px] md:w-[200px]" : "w-[104px] md:w-[140px]"}>
                    <JaxFigure outfit="welcome" width={phase === "jax" ? 200 : 140} showCaption={false} priority className="w-full [&_img]:h-auto [&_img]:w-full" />
                  </div>
                </div>
                <div
                  className="ghd-bubble relative w-full max-w-md rounded-2xl border border-white/10 bg-[#141F1A]/90 px-5 py-4 text-left backdrop-blur"
                  aria-live="polite"
                >
                  <p className="mb-1 text-xs uppercase tracking-[0.3em] text-[#3CB97A]">JAX</p>
                  <p className="font-semibold leading-snug text-[#F0EDE6]">Hey, I&apos;m JAX. Why are you here?</p>
                  <p key={jaxLine} className="ghd-bubble-line mt-2 min-h-[2.5rem] text-sm text-[#B7C6BF]">
                    {jaxLine}
                  </p>
                </div>
              </div>

              {phase === "cards" || phase === "leaving" ? (
                <>
                  <div
                    className="mt-6 grid w-full max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 md:mt-8 md:gap-4"
                    role="group"
                    aria-label="Pick everything that fits"
                  >
                    {welcomeIntentCards.map((card, i) => {
                      const on = selected.includes(card.key);
                      const a = ACCENT[card.accent];
                      return (
                        <button
                          key={card.key}
                          ref={i === 0 ? firstCardRef : undefined}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle(card.key)}
                          data-intent={card.key}
                          className={`ghd-boot-card group relative rounded-2xl border bg-[#0F1714]/85 p-4 text-left transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3CB97A] md:p-5 ${a.ring} ${
                            on ? "ghd-boot-card-on -translate-y-0.5" : "hover:-translate-y-0.5"
                          }`}
                          style={{
                            ["--card-glow" as string]: a.glow,
                            ["--card-fill" as string]: a.fill,
                            animationDelay: `${120 + i * 110}ms`,
                          }}
                        >
                          <span className={`absolute right-4 top-4 text-lg ${a.text}`} aria-hidden>
                            {on ? "✓" : card.glyph}
                          </span>
                          <span className={`block text-xs uppercase tracking-[0.25em] ${a.text}`}>{on ? "Selected" : "I want to"}</span>
                          <span className="mt-1 block font-serif text-xl text-[#F0EDE6] md:text-2xl">{card.title}</span>
                          <span className="mt-1 block text-xs text-[#8A9E96] md:text-sm">{card.sub}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="ghd-boot-actions sticky bottom-0 mt-6 flex w-full max-w-5xl flex-col items-center gap-3 bg-gradient-to-t from-[#070B09] via-[#070B09]/95 to-transparent pb-3 pt-5 md:static md:mt-8 md:flex-row md:justify-between md:bg-none md:pb-0 md:pt-0">
                    <p className="text-xs text-[#4A5E57]">
                      {canContinue
                        ? `${selected.length} picked — JAX tailors your feed, tools and dashboard to this.`
                        : "Pick at least one to continue. Multi-select is on."}
                    </p>
                    <div className="flex items-center gap-4">
                      {!welcomeGate.requireIntent ? (
                        <button type="button" onClick={() => finish(true)} className="text-sm text-[#8A9E96] underline-offset-4 hover:underline">
                          Skip for now
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={!canContinue}
                        onClick={() => finish(false)}
                        className={`ghd-boot-continue rounded-xl px-7 py-3 font-semibold transition-all duration-300 ${
                          canContinue
                            ? "ghd-boot-continue-on bg-[#3CB97A] text-[#0D1512] hover:scale-[1.03]"
                            : "cursor-not-allowed border border-white/10 text-[#4A5E57]"
                        }`}
                      >
                        Tailor my experience →
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
  ) : null;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PRE_HYDRATION_GUARD }} />
      {/* Before hydration the overlay renders in place (hidden pre-paint for
          returning visitors by the guard above); once mounted it portals to
          <body> so no ancestor stacking context (header, motion wrappers) can
          sit above it. */}
      {mounted && typeof document !== "undefined" ? createPortal(overlay, document.body) : overlay}
    </>
  );
}
