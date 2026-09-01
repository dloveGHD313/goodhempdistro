"use client";

/**
 * Phase 5 (Build #4): dedicated Ask JAX chat page — thin wrapper on the
 * existing /api/mascot-chat pipeline. The floating MascotWidget keeps
 * operating independently; this page gives JAX a first-class surface.
 *
 * Eligibility comes from GET /api/jax/eligibility (401 = signed out,
 * eligible=false = free tier). Ineligible visitors see the upgrade panel
 * instead of the chat — the API enforces the same gate server-side.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import MascotAvatar from "@/components/mascot/MascotAvatar";
import type { MascotMessage } from "@/components/mascot/types";
import { getJaxAvatarSources } from "@/components/mascot/spec/jaxSpec";

type Eligibility =
  | { status: "loading" }
  | { status: "unauthed" }
  | {
      status: "ready";
      eligible: boolean;
      tier: string;
      monthlyLimit: number | null;
      currentUsage: number;
    };

type ChatApiResponse = {
  reply: string;
  mood?: MascotMessage["mood"];
  results?: MascotMessage["results"];
};

const QUICK_PROMPTS = [
  "What does a COA tell me?",
  "Is Delta-8 legal in my state?",
  "Find CBD products under $50",
  "How do I start selling on GHD?",
];

const INTRO: MascotMessage[] = [
  {
    id: "askjax-intro",
    role: "assistant",
    content:
      "I'm JAX — hemp compliance, product education, and platform help. What can I dig into for you?",
    mood: "CHILL",
  },
];

export default function AskJaxChat() {
  const [eligibility, setEligibility] = useState<Eligibility>({ status: "loading" });
  const [messages, setMessages] = useState<MascotMessage[]>(INTRO);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const avatarSources = getJaxAvatarSources("JAX_CONSUMER");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/jax/eligibility", { credentials: "include" });
        if (!active) return;
        if (res.status === 401) {
          setEligibility({ status: "unauthed" });
          return;
        }
        const data = (await res.json().catch(() => null)) as
          | { eligible?: boolean; tier?: string; monthlyLimit?: number | null; currentUsage?: number }
          | null;
        setEligibility({
          status: "ready",
          eligible: !!data?.eligible,
          tier: data?.tier ?? "free",
          monthlyLimit: data?.monthlyLimit ?? null,
          currentUsage: data?.currentUsage ?? 0,
        });
      } catch {
        if (!active) return;
        // Can't determine — show the upgrade panel; the API gates for real.
        setEligibility({ status: "ready", eligible: false, tier: "free", monthlyLimit: 0, currentUsage: 0 });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const appendAssistant = useCallback((content: string, mood: MascotMessage["mood"] = "CHILL") => {
    setMessages((prev) => [
      ...prev,
      { id: `assistant-${Date.now()}`, role: "assistant", content, mood, microLine: null },
    ]);
  }, []);

  const handleSend = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value || isTyping) return;
      const nextMessages: MascotMessage[] = [
        ...messages,
        { id: `user-${Date.now()}`, role: "user", content: value },
      ];
      setMessages(nextMessages);
      setInput("");
      setIsTyping(true);
      try {
        const res = await fetch("/api/mascot-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: nextMessages
              .filter((m) => m.id !== "askjax-intro")
              .map((m) => ({ role: m.role, content: m.content })),
            contextMode: "GENERIC",
            route: "/ask-jax",
          }),
        });

        if (res.status === 429) {
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          appendAssistant(
            `${body?.message ?? "You've used your JAX messages for this month."} Upgrade → /pricing`,
            "BLOCKED"
          );
          return;
        }
        if (res.status === 503) {
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          appendAssistant(
            body?.message ?? "JAX is temporarily unavailable. Please try again.",
            "BLOCKED"
          );
          return;
        }

        const payload = (await res.json().catch(() => null)) as ChatApiResponse | null;
        if (!res.ok || !payload?.reply) {
          throw new Error("chat unavailable");
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: payload.reply,
            mood: payload.mood ?? "CHILL",
            results: payload.results ?? null,
            microLine: null,
          },
        ]);
      } catch {
        appendAssistant(
          "AI is temporarily unavailable right now. Please try again in a moment.",
          "BLOCKED"
        );
      } finally {
        setIsTyping(false);
      }
    },
    [appendAssistant, isTyping, messages]
  );

  if (eligibility.status === "loading") {
    return (
      <div className="surface-card p-8 text-center text-muted" role="status">
        Warming up JAX…
      </div>
    );
  }

  if (eligibility.status === "unauthed") {
    return (
      <div className="surface-card p-8 text-center">
        <div className="flex justify-center mb-4">
          <MascotAvatar mascot="JAX" size={64} sources={avatarSources} />
        </div>
        <h2 className="text-xl font-semibold text-accent mb-2">Sign in to chat with JAX</h2>
        <p className="text-muted mb-6 max-w-md mx-auto">
          JAX is available on paid plans. Sign in to your account, or check out the plans to get
          started.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/login?next=/ask-jax" className="btn-primary">
            Sign In
          </Link>
          <Link href="/pricing" className="btn-secondary">
            See Plans
          </Link>
        </div>
      </div>
    );
  }

  if (!eligibility.eligible) {
    return (
      <div className="surface-card p-8 text-center">
        <div className="flex justify-center mb-4">
          <MascotAvatar mascot="JAX" size={64} sources={avatarSources} />
        </div>
        <h2 className="text-xl font-semibold text-accent mb-2">Upgrade to chat with JAX</h2>
        <p className="text-muted mb-6 max-w-md mx-auto">
          Ask JAX about products, compliance, COAs, and growing your hemp business — included with
          every paid consumer and vendor plan.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href="/pricing?tab=consumer" className="btn-primary">
            See Consumer Plans
          </Link>
          <Link href="/pricing?tab=vendor" className="btn-secondary">
            See Vendor Plans
          </Link>
        </div>
      </div>
    );
  }

  const remaining =
    typeof eligibility.monthlyLimit === "number"
      ? Math.max(0, eligibility.monthlyLimit - eligibility.currentUsage)
      : null;

  return (
    <div className="surface-card p-4 md:p-6" data-ask-jax-chat>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <MascotAvatar mascot="JAX" size={44} sources={avatarSources} />
          <div>
            <p className="text-sm font-semibold text-accent">JAX</p>
            <p className="text-xs text-muted">Hemp compliance copilot</p>
          </div>
        </div>
        {remaining !== null && (
          <p className="text-xs text-muted" aria-label="Messages remaining this month">
            {remaining} messages left this month
          </p>
        )}
      </div>

      <div
        ref={threadRef}
        className="mascot-chat"
        style={{ maxHeight: "50vh", minHeight: "18rem", overflowY: "auto" }}
        aria-live="polite"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`mascot-message ${message.role === "user" ? "user" : "assistant"}`}
          >
            <div className="mascot-bubble-text">{message.content}</div>
            {message.role === "assistant" && message.results && message.results.items.length > 0 && (
              <div className="mascot-results">
                {message.results.items.map((item) => (
                  <div key={`${item.title}-${item.href || "item"}`} className="mascot-result-card">
                    <div className="mascot-result-body">
                      <p className="text-sm font-semibold">{item.title}</p>
                      {item.subtitle && <p className="text-xs text-muted">{item.subtitle}</p>}
                      {item.meta && <p className="text-xs text-muted">{item.meta}</p>}
                      {item.href && (
                        <Link href={item.href} className="mascot-result-link">
                          Open →
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="mascot-message assistant">
            <div className="mascot-bubble-text">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          </div>
        )}
      </div>

      <div className="mascot-quick-replies mt-4">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            type="button"
            key={prompt}
            className="mascot-chip"
            onClick={() => handleSend(prompt)}
            disabled={isTyping}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mascot-input-row mt-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleSend(input);
            }
          }}
          placeholder="Ask JAX about hemp, compliance, or the platform…"
          aria-label="Ask JAX"
          disabled={isTyping}
        />
        <button
          type="button"
          onClick={() => handleSend(input)}
          className="btn-primary"
          disabled={isTyping || !input.trim()}
        >
          Send
        </button>
      </div>

      <p className="text-[11px] text-muted mt-3">
        JAX shares general hemp education, not medical or legal advice. State laws vary — for legal
        questions, talk to a hemp-compliance attorney.
      </p>
    </div>
  );
}
