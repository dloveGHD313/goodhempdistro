"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { MascotContext, MascotMove } from "./config";
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
  const enabled = process.env.NEXT_PUBLIC_MASCOT_ENABLED === "true";
  const pathname = usePathname() || "/";
  const [role, setRole] = useState<MascotUserRole>(initialRole);
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [messages, setMessages] = useState<MascotMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [signatureNextAt, setSignatureNextAt] = useState<number | null>(null);
  const [assistantCount, setAssistantCount] = useState(0);
  const [moveOverride, setMoveOverride] = useState<MascotMove | null>(null);
  const moveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContextRef = useRef<MascotContext | null>(null);
  const lastPathReactionRef = useRef<string | null>(null);

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

  const triggerMove = useCallback((move: MascotMove, duration = 900) => {
    setMoveOverride(move);
    if (moveTimeoutRef.current) {
      clearTimeout(moveTimeoutRef.current);
    }
    moveTimeoutRef.current = setTimeout(() => setMoveOverride(null), duration);
  }, []);

  const fetchRole = useCallback(async (user: { id: string } | null) => {
    if (!user) {
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
      isLogistics: Boolean(logisticsPayload?.application && logisticsPayload?.application?.status === "approved"),
    });
  }, []);

  const pushEventMessage = useCallback(
    (content: string, mood: MascotApiResponse["mood"], move?: MascotMove) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content,
          mood,
          microLine: null,
        },
      ]);
      if (move) {
        triggerMove(move);
      }
      setIsOpen(true);
      setTimeout(() => setIsOpen(false), 7000);
    },
    [triggerMove]
  );

  useEffect(() => {
    if (!enabled) return;
    const supabase = createSupabaseBrowserClient();
    let active = true;

    const load = async () => {
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      await fetchRole(data.user ?? null);
    };

    load();

    const authListener = supabase.auth.onAuthStateChange
      ? supabase.auth.onAuthStateChange((event, session) => {
          if (!active) return;
          fetchRole(session?.user ?? null);
          if (event === "SIGNED_IN") {
            pushEventMessage("Welcome back! Want me to pull anything for you?", "SUCCESS", "success_nod");
          }
          if (event === "SIGNED_OUT") {
            pushEventMessage("You're signed out. Come back anytime.", "CHILL", "attention_pop");
          }
        })
      : null;

    return () => {
      active = false;
      authListener?.data?.subscription?.unsubscribe?.();
    };
  }, [enabled, fetchRole, pushEventMessage]);

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

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (lastContextRef.current === context) return;
    lastContextRef.current = context;

    const seenKey = `ghd_mascot_context_${context.toLowerCase()}`;
    if (sessionStorage.getItem(seenKey)) {
      return;
    }
    sessionStorage.setItem(seenKey, "true");

    const greeting =
      context === "VENDOR"
        ? "Vendor mode on. Want help with listings or approvals?"
        : context === "EVENTS"
          ? "Events are live. Want local picks or this weekend?"
          : context === "SHOP"
            ? "Marketplace is open. Tell me what you’re looking for."
            : context === "FEED"
              ? "Feed is moving. Want trending posts or vendor highlights?"
              : context === "DELIVERY_DRIVER"
                ? "Driver view ready. Need your latest deliveries?"
                : context === "B2B_LOGISTICS"
                  ? "Logistics mode ready. Want assigned loads?"
                  : "Need a hand navigating the site?";

    pushEventMessage(greeting, "CHILL", "attention_pop");
  }, [context, enabled, pushEventMessage]);

  useEffect(() => {
    if (!enabled) return;
    const normalizedPath = pathname.toLowerCase();
    if (lastPathReactionRef.current === normalizedPath) return;

    if (normalizedPath.includes("success")) {
      lastPathReactionRef.current = normalizedPath;
      pushEventMessage("Success! Want me to line up your next step?", "SUCCESS", "success_nod");
      return;
    }
    if (normalizedPath.includes("cancel") || normalizedPath.includes("error")) {
      lastPathReactionRef.current = normalizedPath;
      pushEventMessage("Something didn't go through. Want me to help fix it?", "ERROR", "error_shake");
    }
  }, [enabled, pathname, pushEventMessage]);

  useEffect(() => {
    return () => {
      if (moveTimeoutRef.current) {
        clearTimeout(moveTimeoutRef.current);
      }
    };
  }, []);

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
          Need help finding posts, products, or events?
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
        moveOverride={moveOverride}
      />
    </div>
  );
}
