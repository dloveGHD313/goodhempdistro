"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { MascotContext, MascotMove } from "./config";
import { mascotByContext, mascotAssets, quickRepliesByContext } from "./config";
import { detectContext, type MascotUserRole } from "./context";
import MascotPanel, { type UpgradeContext } from "./MascotPanel";
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

type EligibilityState =
  | { status: "unknown" }
  | { status: "unauthed" }
  | { status: "authed"; eligible: boolean };

function getUpgradeContext(
  eligibility: EligibilityState,
  route: string
): UpgradeContext | null {
  if (eligibility.status === "unauthed") {
    return {
      title: "Chat with JAX",
      message:
        "Sign in to chat with JAX, or upgrade for unlimited AI assistance about hemp, products, and the platform.",
      primaryButton: { label: "Sign In", href: "/login" },
      secondaryButton: { label: "See Plans", href: "/pricing" },
    };
  }
  if (eligibility.status === "authed" && !eligibility.eligible) {
    const isVendorContext =
      route.startsWith("/vendor") ||
      route.startsWith("/vendors") ||
      route.startsWith("/wholesale");
    if (isVendorContext) {
      return {
        title: "Unlock JAX for your business",
        message:
          "Become a vendor to unlock JAX for compliance, COA help, product listings, and business guidance.",
        primaryButton: { label: "See Vendor Plans", href: "/pricing?tab=vendor" },
        secondaryButton: null,
      };
    }
    return {
      title: "Upgrade to chat with JAX",
      message:
        "Upgrade your account to chat with JAX about products, vendors, hemp education, and more.",
      primaryButton: { label: "See Consumer Plans", href: "/pricing?tab=consumer" },
      secondaryButton: null,
    };
  }
  return null;
}

const tooltipKey = "ghd_mascot_tooltip_shown";
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
  const hasInteractionRef = useRef(false);
  const [eligibility, setEligibility] = useState<EligibilityState>({ status: "unknown" });
  const eligibilityFetchedRef = useRef(false);

  const ensureEligibilityLoaded = useCallback(async () => {
    if (eligibilityFetchedRef.current) return;
    eligibilityFetchedRef.current = true;
    try {
      const res = await fetch("/api/jax/eligibility", { credentials: "include" });
      if (res.status === 401) {
        setEligibility({ status: "unauthed" });
        return;
      }
      const data = (await res.json().catch(() => null)) as { eligible?: boolean } | null;
      setEligibility({ status: "authed", eligible: !!data?.eligible });
    } catch {
      // If we can't determine, fall back to "authed but ineligible" to be safe —
      // the API itself will gate the actual chat. Showing the upgrade UI is better
      // than crashing the widget.
      setEligibility({ status: "authed", eligible: false });
    }
  }, []);

  const upgradeContext = useMemo(
    () => getUpgradeContext(eligibility, pathname),
    [eligibility, pathname]
  );

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
      ? supabase.auth.onAuthStateChange((_event, session) => {
          if (!active) return;
          fetchRole(session?.user ?? null);
        })
      : null;

    return () => {
      active = false;
      authListener?.data?.subscription?.unsubscribe?.();
    };
  }, [enabled, fetchRole, pushEventMessage]);

  useEffect(() => {
    if (!enabled) return;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{
        message?: string;
        mood?: MascotApiResponse["mood"];
        move?: MascotMove;
        showTooltip?: boolean;
      }>).detail;
      if (!detail?.message) return;
      hasInteractionRef.current = true;
      if (detail.showTooltip) {
        setShowTooltip(true);
        sessionStorage.setItem(tooltipKey, "true");
      }
      pushEventMessage(detail.message, detail.mood || "CHILL", detail.move);
    };
    window.addEventListener("ghd_mascot_event", handler as EventListener);
    return () => window.removeEventListener("ghd_mascot_event", handler as EventListener);
  }, [enabled, pushEventMessage]);

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

      if (response.status === 403) {
        const errorBody = await response.json().catch(() => null) as
          | { message?: string; upgradeUrl?: string }
          | null;
        const upgradeUrl = errorBody?.upgradeUrl ?? "/pricing";
        const message = errorBody?.message ?? "JAX is available with a paid plan.";
        setMessages([
          ...nextMessages,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: `${message} See plans → ${upgradeUrl}`,
            mood: "BLOCKED",
            microLine: null,
          },
        ]);
        return;
      }

      if (response.status === 429) {
        const errorBody = await response.json().catch(() => null) as
          | { message?: string; upgradeUrl?: string; monthlyLimit?: number; currentUsage?: number }
          | null;
        const upgradeUrl = errorBody?.upgradeUrl ?? "/pricing";
        const message =
          errorBody?.message ??
          "You've used your JAX messages for this month. Upgrade for more.";
        setMessages([
          ...nextMessages,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: `${message} Upgrade → ${upgradeUrl}`,
            mood: "BLOCKED",
            microLine: null,
          },
        ]);
        return;
      }

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
        onToggle={() => {
          hasInteractionRef.current = true;
          // Lazy-load eligibility on first interaction so the widget bubble
          // doesn't fire an API call for every page view.
          ensureEligibilityLoaded();
          setIsOpen((prev) => {
            const next = !prev;
            if (next && messages.length === 0) {
              setMessages([
                {
                  id: "mascot-intro-1",
                  role: "assistant",
                  content: "I’m JAX. Welcome to Good Hemp Distros.",
                  mood: "CHILL",
                },
                {
                  id: "mascot-intro-2",
                  role: "assistant",
                  content: "You here to learn, shop, post, or earn with me?",
                  mood: "CHILL",
                },
              ]);
            }
            return next;
          });
        }}
        onSend={handleSend}
        isTyping={isTyping}
        quickReplies={quickReplies}
        messages={messages}
        avatarSources={avatarSources}
        headerLabel={headerLabel}
        headerTitle={headerTitle}
        headerTagline={headerTagline}
        moveOverride={moveOverride}
        upgradeContext={upgradeContext}
      />
    </div>
  );
}
