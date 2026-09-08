"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Small client-side helpers for the Phase 0 boot sequence — no assets, no
 * network: a typewriter, a pointer-parallax hook and a synthesized UI sound
 * (Web Audio, off by default, opt-in persisted in localStorage).
 */

/** Reveal `text` one character at a time. `instant` shows it whole (reduced motion / SSR). */
export function useTypewriter(text: string, opts: { cps?: number; instant?: boolean; startDelay?: number } = {}) {
  const { cps = 38, instant = false, startDelay = 0 } = opts;
  const [shown, setShown] = useState(instant ? text : "");
  const [done, setDone] = useState(instant);
  useEffect(() => {
    let i = 0;
    let timer: number | undefined;
    if (instant) {
      timer = window.setTimeout(() => {
        setShown(text);
        setDone(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const step = () => {
      if (i === 0) setDone(false);
      i += 1;
      setShown(text.slice(0, i));
      if (i < text.length) {
        // punctuation gets a beat, like a read line
        const ch = text[i - 1];
        const pause = ch === "." || ch === "?" || ch === "—" ? 260 : ch === "," ? 120 : 1000 / cps;
        timer = window.setTimeout(step, pause);
      } else {
        setDone(true);
      }
    };
    timer = window.setTimeout(() => {
      setShown("");
      step();
    }, startDelay);
    return () => window.clearTimeout(timer);
  }, [text, cps, instant, startDelay]);
  return { shown, done };
}

/** Pointer parallax: writes --px/--py (−1..1) on the given element. */
export function useParallax(enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const { innerWidth: w, innerHeight: h } = window;
      const px = ((e.clientX / w) * 2 - 1).toFixed(3);
      const py = ((e.clientY / h) * 2 - 1).toFixed(3);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--px", px);
        el.style.setProperty("--py", py);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);
  return ref;
}

export const BOOT_SOUND_KEY = "ghd_boot_sound";

type Cue = "tick" | "pick" | "unpick" | "enter" | "go";

/**
 * Synthesized UI cues so the sequence can have sound without shipping audio
 * files (the CEO's theme audio lands later — this is the hook for it). Default
 * OFF; the visitor opts in with the speaker toggle and the choice persists.
 */
export function useBootSound() {
  const [on, setOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // read the persisted choice after mount (deferred so it never races hydration)
    const t = window.setTimeout(() => {
      try {
        setOn(window.localStorage.getItem(BOOT_SOUND_KEY) === "1");
      } catch {
        /* storage unavailable */
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const ctx = useCallback(() => {
    if (typeof window === "undefined") return null;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctxRef.current) ctxRef.current = new AC();
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const play = useCallback(
    (cue: Cue) => {
      if (!on) return;
      const c = ctx();
      if (!c) return;
      const t = c.currentTime;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      const env = (peak: number, len: number) => {
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
        osc.start(t);
        osc.stop(t + len + 0.02);
      };
      switch (cue) {
        case "tick":
          osc.type = "square";
          osc.frequency.setValueAtTime(1800, t);
          env(0.02, 0.05);
          break;
        case "pick":
          osc.type = "sine";
          osc.frequency.setValueAtTime(520, t);
          osc.frequency.exponentialRampToValueAtTime(880, t + 0.12);
          env(0.08, 0.18);
          break;
        case "unpick":
          osc.type = "sine";
          osc.frequency.setValueAtTime(660, t);
          osc.frequency.exponentialRampToValueAtTime(330, t + 0.12);
          env(0.06, 0.16);
          break;
        case "enter":
          osc.type = "triangle";
          osc.frequency.setValueAtTime(220, t);
          osc.frequency.exponentialRampToValueAtTime(440, t + 0.35);
          env(0.09, 0.5);
          break;
        case "go":
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(160, t);
          osc.frequency.exponentialRampToValueAtTime(1200, t + 0.5);
          env(0.07, 0.6);
          break;
      }
    },
    [on, ctx]
  );

  const toggle = useCallback(() => {
    const next = !on;
    try {
      window.localStorage.setItem(BOOT_SOUND_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (next) {
      // unlock the context inside the user gesture and confirm with a soft ping
      const c = ctx();
      if (c) {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.connect(g);
        g.connect(c.destination);
        g.gain.setValueAtTime(0.0001, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.06, c.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.15);
        osc.frequency.setValueAtTime(880, c.currentTime);
        osc.start();
        osc.stop(c.currentTime + 0.17);
      }
    }
    setOn(next);
  }, [on, ctx]);

  return useMemo(() => ({ on, toggle, play }), [on, toggle, play]);
}
