"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile widget (human verification).
 *
 * Renders NOTHING when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset, so pages are
 * unchanged until the key pair lands in Vercel (see lib/server/turnstile.ts).
 *
 * Inside a native <form>, Turnstile injects a hidden input named
 * `cf-turnstile-response`, which server actions read via TURNSTILE_FIELD.
 * For fetch/JSON forms, pass `onToken` and send the token as
 * `turnstileToken` in the body.
 */

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("turnstile script failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile script failed"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

type Props = {
  /** Receives the token when solved, null when expired/reset. */
  onToken?: (token: string | null) => void;
  /** Optional action label shown in Cloudflare analytics (a-z, 0-9, _ -). */
  action?: string;
  className?: string;
};

export default function TurnstileWidget({ onToken, action, className = "" }: Props) {
  const siteKey = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "").trim();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "dark",
          size: "flexible",
          action,
          callback: (token: string) => onTokenRef.current?.(token),
          "expired-callback": () => onTokenRef.current?.(null),
          "error-callback": () => onTokenRef.current?.(null),
        });
      })
      .catch(() => {
        // Script blocked (ad blocker / offline): leave the form usable; the
        // server will reject with a clear "refresh and try again" message.
      });
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* already gone */
        }
      }
      widgetIdRef.current = null;
    };
  }, [siteKey, action]);

  if (!siteKey) return null;
  return <div ref={containerRef} className={`my-3 ${className}`} />;
}
