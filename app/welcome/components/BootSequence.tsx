"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { useBootSound, useParallax, useTypewriter } from "./useBootFx";

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

const GREETING = "Hey, I'm JAX. Why are you here?";
const TAGLINE = "Every vendor. Every product. One platform.";

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

function laneLabel(selected: readonly string[]): string {
  const p = primaryIntent(selected);
  const card = welcomeIntentCards.find((c) => c.key === p);
  return card ? card.title : "your";
}

/**
 * Phase 0 boot sequence — the roadmap's "futuristic app-OS boot-up meets movie
 * trailer" entry. Plays once per visitor (localStorage flag), never for
 * signed-in users, never when ?intent= or ?noboot= is present (deep links,
 * Lighthouse). Reduced-motion visitors go straight to the question.
 *
 * Deliberately avoids useSearchParams(): that would push this subtree to
 * client-only rendering and the hero would flash before the overlay mounts.
 * The overlay is in the server HTML from the first byte.
 *
 * Flow: letterboxed boot ticker + tagline → JAX walks in and types the
 * question → nine intent cards pop in one after another (multi-select, keys
 * 1–9, Enter to continue; Continue disabled until ≥1) → JAX reacts to each
 * pick → Continue locks the lane, stores the intents (lib/phase0-storage,
 * later persisted to profiles.welcome_intents by PersistWelcomeIntents after
 * auth) and hands off to /signup → /onboarding.
 *
 * Returning members: "Sign in" is always visible top-right (marks the boot as
 * seen so it never replays for them); sound is opt-in via the speaker toggle.
 */
export default function BootSequence({ stats, isAuthenticated }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(true);
  const [phase, setPhase] = useState<Phase>("boot");
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [lastToggled, setLastToggled] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);
  const [nod, setNod] = useState(false);
  const firstCardRef = useRef<HTMLButtonElement | null>(null);
  const lines = useMemo(() => bootLines(stats), [stats]);
  const sound = useBootSound();
  const stageRef = useParallax(mounted && show && !reduced);

  // Decide once, on the client, whether this visitor gets the sequence.
  // Deferred a tick so the decision never races hydration (a timer, not
  // requestAnimationFrame, so a link opened in a background tab still resolves).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      let seen = false;
      try {
        seen = !!window.localStorage.getItem(BOOT_SEEN_KEY);
      } catch {
        seen = false;
      }
      const qs = new URLSearchParams(window.location.search);
      const deepLink = qs.has("intent") || qs.has("noboot");
      const prefersReduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      setMounted(true);
      if (isAuthenticated || seen || deepLink) {
        setShow(false);
        return;
      }
      setReduced(prefersReduced);
      if (prefersReduced) setPhase("cards");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated]);

  // Lock the page behind the overlay while it's up.
  useEffect(() => {
    if (!mounted || !show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted, show]);

  const tagline = useTypewriter(TAGLINE, { instant: reduced, startDelay: 1100, cps: 24 });

  // Boot ticker → (tagline finishes) → JAX → cards.
  useEffect(() => {
    if (!mounted || !show || reduced) return;
    if (phase !== "boot") return;
    if (tick < lines.length) {
      const t = setTimeout(() => {
        setTick((n) => n + 1);
        sound.play("tick");
      }, tick === 0 ? 900 : 260);
      return () => clearTimeout(t);
    }
    if (!tagline.done) return;
    const t = setTimeout(() => setPhase("jax"), 700);
    return () => clearTimeout(t);
    // sound.play is stable per `on`; re-running on toggle is harmless
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, show, reduced, phase, tick, lines.length, tagline.done]);

  useEffect(() => {
    if (phase !== "jax") return;
    sound.play("enter");
    const t = setTimeout(() => setPhase("cards"), 1900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase === "cards") {
      const t = setTimeout(() => firstCardRef.current?.focus({ preventScroll: true }), 700);
      return () => clearTimeout(t);
    }
  }, [phase]);

  const toggle = useCallback(
    (key: string) => {
      const on = selected.includes(key);
      sound.play(on ? "unpick" : "pick");
      setSelected(on ? selected.filter((k) => k !== key) : [...selected, key]);
      setLastToggled(key);
      setNod(true);
    },
    [selected, sound]
  );

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
      sound.play("go");
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
      setTimeout(() => router.push(target), reduced ? 120 : 900);
    },
    [selected, isAuthenticated, router, reduced, sound]
  );

  const canContinue = selected.length > 0;

  // Keyboard: 1–9 toggles a card, Enter continues (when allowed).
  useEffect(() => {
    if (!mounted || !show || phase !== "cards") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const n = Number(e.key);
      if (n >= 1 && n <= welcomeIntentCards.length) {
        e.preventDefault();
        toggle(welcomeIntentCards[n - 1].key);
      } else if (e.key === "Enter" && canContinue) {
        e.preventDefault();
        finish(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, show, phase, toggle, finish, canContinue]);

  // Returning members: leave through the door, not the questionnaire.
  const markSeen = useCallback(() => {
    try {
      window.localStorage.setItem(BOOT_SEEN_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }, []);

  const jaxLine = phase === "leaving" && canContinue
    ? `Locking in your ${laneLabel(selected)} lane. See you inside.`
    : jaxLineFor(selected, lastToggled);
  const greeting = useTypewriter(GREETING, { instant: reduced || phase === "boot", startDelay: 500, cps: 30 });
  const reaction = useTypewriter(jaxLine, { instant: reduced || !greeting.done, cps: 46 });
  const stageIndex = phase === "boot" ? 0 : phase === "jax" ? 1 : 2;

  const overlay = show ? (
        <div
          ref={stageRef}
          className={`ghd-boot fixed inset-0 z-[200] flex flex-col overflow-y-auto overflow-x-hidden bg-[#070B09] text-[#F0EDE6] ${
            phase === "leaving" ? "ghd-boot-leave" : ""
          }`}
          role="dialog"
          aria-modal="true"
          aria-label="Welcome to Good Hemp Distro"
          data-phase={phase}
        >
          <div className="ghd-aurora ghd-boot-parallax" aria-hidden />
          <div className="ghd-grain" aria-hidden />
          <div className="ghd-boot-scan" aria-hidden />
          <div className="ghd-boot-bar ghd-boot-bar-top" aria-hidden />
          <div className="ghd-boot-bar ghd-boot-bar-bottom" aria-hidden />
          <div className="ghd-boot-wipe" aria-hidden />

          {/* ── Chrome: sound toggle · stage rail · sign-in ── */}
          <div className="ghd-boot-chrome pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 md:px-6">
            <button
              type="button"
              onClick={sound.toggle}
              aria-pressed={sound.on}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-[#8A9E96] backdrop-blur transition hover:border-[#3CB97A]/50 hover:text-[#F0EDE6]"
              title={sound.on ? "Sound on" : "Sound off"}
            >
              <span aria-hidden>{sound.on ? "🔊" : "🔈"}</span>
              <span className="hidden sm:inline">{sound.on ? "Sound on" : "Sound off"}</span>
            </button>
            <ol className="hidden items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-[#4A5E57] sm:flex" aria-label="Progress">
              {["Boot", "JAX", "Your lane"].map((s, i) => (
                <li key={s} className={`flex items-center gap-2 ${i <= stageIndex ? "text-[#3CB97A]" : ""}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${i <= stageIndex ? "bg-[#3CB97A]" : "bg-[#2A3A33]"}`} aria-hidden />
                  {s}
                </li>
              ))}
            </ol>
            <Link
              href="/login"
              onClick={markSeen}
              className="pointer-events-auto rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-[#B7C6BF] backdrop-blur transition hover:border-[#3CB97A]/50 hover:text-[#F0EDE6]"
            >
              Already a member? <span className="font-semibold text-[#3CB97A]">Sign in →</span>
            </Link>
          </div>

          {/* ── Phase A: trailer + boot ticker ── */}
          {phase === "boot" ? (
            <div className="ghd-boot-stage relative z-10 flex flex-1 flex-col items-center justify-center px-6">
              <p className="ghd-boot-mark text-[11px] uppercase tracking-[0.6em] text-[#3CB97A]">The hemp industry platform</p>
              <h1 className="ghd-boot-title mt-4 font-serif text-4xl md:text-6xl text-center">
                <span className="ghd-shimmer">Good Hemp Distros</span>
              </h1>
              <p className="mt-3 min-h-[1.75rem] font-serif text-base text-[#B7C6BF] md:text-xl" aria-live="polite">
                {tagline.shown}
                {!tagline.done ? <span className="ghd-caret" aria-hidden /> : null}
              </p>
              <ol className="ghd-boot-ticker mt-8 w-full max-w-md font-mono text-xs md:text-sm text-[#8A9E96]" aria-live="polite">
                {lines.slice(0, tick).map((l, i) => (
                  <li key={l} className="ghd-boot-line flex items-center gap-3 py-1" style={{ animationDelay: `${i * 20}ms` }}>
                    <span className="ghd-boot-dot h-1.5 w-1.5 rounded-full bg-[#3CB97A]" aria-hidden />
                    <span>{l}</span>
                    <span className="ml-auto text-[#3CB97A]/70">ok</span>
                  </li>
                ))}
              </ol>
              <div className="ghd-boot-progress mt-8 h-px w-full max-w-md overflow-hidden bg-white/10" aria-hidden>
                <div className="h-full bg-[#3CB97A] transition-[width] duration-200" style={{ width: `${Math.round((tick / lines.length) * 100)}%` }} />
              </div>
            </div>
          ) : null}

          {/* ── Phase B + C: JAX asks, cards answer ── */}
          {phase !== "boot" ? (
            <div className="ghd-boot-stage relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-14 md:px-8">
              <div className="ghd-boot-jax flex w-full max-w-5xl flex-col items-center gap-4 md:flex-row md:items-end md:justify-center md:gap-8">
                <div className="ghd-boot-spot ghd-float shrink-0">
                  <div
                    onAnimationEnd={() => setNod(false)}
                    className={`ghd-boot-parallax-jax ${nod ? "ghd-boot-nod" : ""} ${phase === "jax" ? "w-[170px] md:w-[230px]" : "w-[104px] md:w-[140px]"}`}
                  >
                    <JaxFigure outfit="welcome" width={phase === "jax" ? 230 : 140} showCaption={false} priority className="w-full [&_img]:h-auto [&_img]:w-full" />
                  </div>
                </div>
                <div
                  className="ghd-bubble relative w-full max-w-md rounded-2xl border border-white/10 bg-[#141F1A]/90 px-5 py-4 text-left backdrop-blur"
                  aria-live="polite"
                >
                  <p className="mb-1 text-xs uppercase tracking-[0.3em] text-[#3CB97A]">JAX</p>
                  <p className="font-semibold leading-snug text-[#F0EDE6]">
                    {greeting.shown}
                    {!greeting.done ? <span className="ghd-caret" aria-hidden /> : null}
                  </p>
                  <p key={jaxLine} className="ghd-bubble-line mt-2 min-h-[2.5rem] text-sm text-[#B7C6BF]">
                    {greeting.done ? reaction.shown : ""}
                    {greeting.done && !reaction.done ? <span className="ghd-caret" aria-hidden /> : null}
                  </p>
                  {selected.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Your picks">
                      {selected.map((k) => {
                        const c = welcomeIntentCards.find((x) => x.key === k);
                        if (!c) return null;
                        const a = ACCENT[c.accent];
                        return (
                          <li key={k} className={`ghd-boot-chip rounded-full border px-2.5 py-0.5 text-[11px] ${a.ring} ${a.text}`}>
                            {c.title}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
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
                          aria-keyshortcuts={String(i + 1)}
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
                          <span className="absolute left-4 top-4 hidden h-5 w-5 items-center justify-center rounded border border-white/10 font-mono text-[10px] text-[#4A5E57] md:flex" aria-hidden>
                            {i + 1}
                          </span>
                          <span className={`block text-xs uppercase tracking-[0.25em] md:pl-7 ${a.text}`}>{on ? "Selected" : "I want to"}</span>
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
                      <span className="hidden md:inline"> Keys 1–9 pick, Enter continues.</span>
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
