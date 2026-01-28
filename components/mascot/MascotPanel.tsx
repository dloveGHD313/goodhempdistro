"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { MascotContext, MascotId } from "./config";
import { mascotAssets } from "./config";
import MascotAvatar from "./MascotAvatar";
import { getMoveForMood } from "./mood";
import type { MascotMessage, MascotResults } from "./types";

type Props = {
  mascot: MascotId;
  context: MascotContext;
  isOpen: boolean;
  onToggle: () => void;
  onSend: (value: string) => void;
  isTyping: boolean;
  quickReplies: string[];
  messages: MascotMessage[];
  avatarSources?: readonly string[];
  headerLabel: string;
  headerTitle: string;
  headerTagline: string;
};

export default function MascotPanel({
  mascot,
  context,
  isOpen,
  onToggle,
  onSend,
  isTyping,
  quickReplies,
  messages,
  avatarSources,
  headerLabel,
  headerTitle,
  headerTagline,
}: Props) {
  const [input, setInput] = useState("");
  const asset = mascotAssets[mascot];
  const lastMood = useMemo(() => {
    const last = [...messages].reverse().find((msg) => msg.role === "assistant");
    return last?.mood || "CHILL";
  }, [messages]);
  const avatarMove = isTyping ? "typing_pulse" : getMoveForMood(lastMood);

  const handleSubmit = () => {
    const value = input.trim();
    if (!value) return;
    onSend(value);
    setInput("");
  };

  return (
    <div className={`mascot-shell ${isOpen ? "open" : ""}`}>
      {isOpen && (
        <div className="mascot-panel card-glass" role="dialog" aria-label="Mascot assistant">
          <div className="mascot-panel-header">
            <div className="mascot-panel-title">
              <MascotAvatar mascot={mascot} move={avatarMove} sources={avatarSources} />
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-muted">{headerLabel}</p>
                <h3 className="text-lg font-semibold text-accent">{headerTitle}</h3>
                <p className="text-xs text-muted">{headerTagline}</p>
              </div>
            </div>
            <button type="button" className="mascot-close" onClick={onToggle} aria-label="Minimize">
              ✕
            </button>
          </div>

          <div className="mascot-chat">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`mascot-message ${message.role === "user" ? "user" : "assistant"}`}
              >
                {message.role === "assistant" && message.microLine && (
                  <div className="mascot-micro">{message.microLine}</div>
                )}
                <div className="mascot-bubble-text">{message.content}</div>
                {message.role === "assistant" && message.results && message.results.items.length > 0 && (
                  <div className="mascot-results">
                    {message.results.items.map((item) => (
                      <div key={`${item.title}-${item.href || "item"}`} className="mascot-result-card">
                        {item.imageUrl && (
                          <div className="mascot-result-image">
                            <img src={item.imageUrl} alt={item.title} loading="lazy" />
                          </div>
                        )}
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

          <div className="mascot-quick-replies">
            {quickReplies.map((reply) => (
              <button
                type="button"
                key={reply}
                className="mascot-chip"
                onClick={() => onSend(reply)}
              >
                {reply}
              </button>
            ))}
          </div>

          <div className="mascot-input-row">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Ask the mascot..."
              aria-label="Ask the mascot"
            />
            <button type="button" onClick={handleSubmit} className="btn-primary">
              Send
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="mascot-bubble"
        onClick={onToggle}
        aria-label="Open mascot assistant"
      >
        <MascotAvatar mascot={mascot} size={40} move={avatarMove} sources={avatarSources} />
        <span className="mascot-bubble-text">Ask {asset.name}</span>
      </button>
    </div>
  );
}
