"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { MascotContext } from "./config";
import { mascotByContext, mascotAssets, quickRepliesByContext } from "./config";
import { detectContext, type MascotUserRole } from "./context";
import MascotPanel from "./MascotPanel";
import type { MascotMessage, MascotResults } from "./types";
import { pickMicroLine } from "./microLines";
import { getJaxAvatarSources, getJaxPersona, jaxSpec } from "./spec/jaxSpec";

type MascotApiResponse = {
  reply: string;
  mood: "CHILL" | "FOCUSED" | "EDUCATIONAL" | "URGENT" | "SUCCESS" | "ERROR" | "BLOCKED" | "COMPLIANCE" | "LEGAL";
  results: MascotResults;
  suggestions: string[];
};

const initialRole: MascotUserRole = {
  isAdmin: false,
  isVendor: false,
  isVendorSubscribed: false,
  isConsumerSubscribed: false,
  isDriver: false,
  isLogistics: false,
};

const tooltipKey = "ghd_mascot_tooltip_shown";
const welcomeKey = "ghd_mascot_welcome_seen";
const contextLabels: Record<MascotContext, string> = {
  FEED: "Feed",
  SHOP: "Shop",
  EVENTS: "Events",
  VENDOR: "Vendor",
  DELIVERY_DRIVER: "Driver",
  B2B_LOGISTICS: "Logistics",
  GENERIC: "Guide",
};

export default function MascotWidget() {
  const enabled =
    process.env.NEXT_PUBLIC_MASCOT_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_MASCOT_AI_ENABLED === "true";
  const pathname = usePathname() || "/";
  const [role, setRole] = useState<MascotUserRole>(initialRole);
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [messages, setMessages] = useState<MascotMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [signatureNextAt, setSignatureNextAt] = useState<number | null>(null);
  const [assistantCount, setAssistantCount] = useState(0);

  const context: MascotContext = useMemo(() => detectContext(pathname, role), [pathname, role]);
  const mascot = mascotByContext[context];
  const persona = mascot === "JAX" ? getJaxPersona(context, role) : null;
  const asset = mascotAssets[mascot];
  const avatarSources = mascot === "JAX" ? getJaxAvatarSources(persona ?? "JAX_CONSUMER") : undefined;
  const headerLabel =
    mascot === "JAX"
      ? persona === "JAX_VENDOR"
        ? jaxSpec.header.vendorSubtitle
        : jaxSpec.header.consumerSubtitle
      : `${asset.name} · ${contextLabels[context]}`;
  const headerTitle = mascot === "JAX" ? jaxSpec.header.title : `${asset.name} Mascot AI`;
  const headerTagline =
    mascot === "JAX" ? jaxSpec.personas[persona ?? "JAX_CONSUMER"].tagline : asset.tagline;
  const quickReplies = quickRepliesByContext[context];

  useEffect(() => {
    if (!enabled) return;
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setRole(initialRole);
        return;
      }

      const [vendorRes, consumerRes, driverRes, logisticsRes] = await Promise.allSettled([
        fetch("/api/vendor/status", { cache: "no-store" }),
        fetch("/api/consumer/status", { cache: "no-store" }),
        fetch("/api/driver/me", { cache: "no-store" }),
        fetch("/api/logistics/me", { cache: "no-store" }),
      ]);

      const vendorPayload =
        vendorRes.status === "fulfilled" && vendorRes.value.ok ? await vendorRes.value.json() : null;
      const consumerPayload =
        consumerRes.status === "fulfilled" && consumerRes.value.ok
          ? await consumerRes.value.json()
          : null;
      const driverPayload =
        driverRes.status === "fulfilled" && driverRes.value.ok ? await driverRes.value.json() : null;
      const logisticsPayload =
        logisticsRes.status === "fulfilled" && logisticsRes.value.ok
          ? await logisticsRes.value.json()
          : null;

      setRole({
        isAdmin: Boolean(vendorPayload?.isAdmin || consumerPayload?.isAdmin),
        isVendor: Boolean(vendorPayload?.isVendor),
        isVendorSubscribed: Boolean(vendorPayload?.isSubscribed),
        isConsumerSubscribed: Boolean(consumerPayload?.isSubscribed),
        isDriver: Boolean(driverPayload?.driver && driverPayload?.driver?.status === "approved"),
        isLogistics: Boolean(
          logisticsPayload?.application && logisticsPayload?.application?.status === "approved"
        ),
      });
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const seenWelcome = typeof window !== "undefined" && sessionStorage.getItem(welcomeKey);
    if (!seenWelcome) {
      setIsOpen(true);
      sessionStorage.setItem(welcomeKey, "true");
      const timer = setTimeout(() => setIsOpen(false), 9000);
      return () => clearTimeout(timer);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(tooltipKey)) return;
    const timer = setTimeout(() => {
      setShowTooltip(true);
      sessionStorage.setItem(tooltipKey, "true");
    }, 20000);
    return () => clearTimeout(timer);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (messages.length === 0) {
      setMessages([
        {
          id: "mascot-welcome",
          role: "assistant",
          content:
            "Welcome to Good Hemp Distros. Tell me what you need and I'll guide you to the right flow.",
          mood: "CHILL",
        },
      ]);
    }
  }, [enabled, messages.length]);

  if (!enabled) {
    return null;
  }

  const handleSend = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const nextMessages = [
      ...messages,
      { id: `user-${Date.now()}`, role: "user", content: trimmed },
    ] as MascotMessage[];
    setMessages(nextMessages);
    setIsTyping(true);

    try {
      const response = await fetch("/api/mascot-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((msg) => ({ role: msg.role, content: msg.content })),
          contextMode: context,
          route: pathname,
          userRole: role,
        }),
      });
      const payload: MascotApiResponse | null = await response.json().catch(() => null);
      if (!response.ok || !payload?.reply) {
        throw new Error("Mascot API unavailable");
      }
      const nextIndex = assistantCount + 1;
      const micro = pickMicroLine({
        mascot,
        context,
        mood: payload.mood,
        allowSignature: mascot === "JAX",
        signatureMode: payload.reply.includes("?") ? "clarify" : "ack",
        previousSignatureAt: signatureNextAt,
        messageIndex: nextIndex,
        persona: mascot === "JAX" ? persona ?? "JAX_CONSUMER" : undefined,
      });

      setAssistantCount(nextIndex);
      if (micro.nextSignatureAt !== null) {
        setSignatureNextAt(micro.nextSignatureAt);
      }

      setMessages([
        ...nextMessages,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: payload.reply,
          mood: payload.mood,
          results: payload.results,
          microLine: micro.line,
        },
      ]);
    } catch (error) {
      setMessages([
        ...nextMessages,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: "AI is temporarily unavailable right now. Please try again in a moment.",
          mood: "BLOCKED",
          microLine: null,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="mascot-widget">
      {showTooltip && !isOpen && (
        <div className="mascot-tooltip" role="status">
          Need help navigating? Tap me anytime.
        </div>
      )}
      <MascotPanel
        mascot={mascot}
        context={context}
        isOpen={isOpen}
        onToggle={() => setIsOpen((prev) => !prev)}
        onSend={handleSend}
        isTyping={isTyping}
        quickReplies={quickReplies}
        messages={messages}
        avatarSources={avatarSources}
        headerLabel={headerLabel}
        headerTitle={headerTitle}
        headerTagline={headerTagline}
      />
    </div>
  );
}
