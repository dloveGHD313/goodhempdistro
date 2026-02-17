"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  getWelcomeProfile,
  setWelcomeProfile,
  WELCOME_INTENT_OPTIONS,
  type WelcomeIntentOption,
} from "@/lib/phase0-storage";
import { brand } from "@/lib/brand";
import useAuthUser from "@/components/engagement/useAuthUser";
import JaxWelcomeHero from "@/components/mascot/JaxWelcomeHero";

const INTENT_LABELS: Record<WelcomeIntentOption, string> = {
  shop: "Shop",
  sell: "Sell",
  events: "Events",
  explore: "Explore",
  services: "Services",
  drivers: "Drivers",
  affiliates: "Affiliates",
  business: "Business",
  industrial: "Industrial / Hemp Building",
};

const INTENT_DESCRIPTIONS: Record<WelcomeIntentOption, string> = {
  shop: "Buy products",
  sell: "Vendor / Brand",
  events: "Find events",
  explore: "Community / Feed",
  services: "Hire / Offer services",
  drivers: "Logistics",
  affiliates: "Affiliate program",
  business: "Wholesale / B2B",
  industrial: "Construction, materials, large-scale",
};

type WelcomeClientProps = {
  /** When provided (from server), mascot shows only when both NEXT_PUBLIC_MASCOT_ENABLED and MASCOT_AI_ENABLED are true */
  mascotEnabled?: boolean;
};

export default function WelcomeClient({ mascotEnabled: serverMascotEnabled }: WelcomeClientProps = {}) {
  const router = useRouter();
  const { userId, loading: authLoading } = useAuthUser();
  const [selectedIntents, setSelectedIntents] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = getWelcomeProfile();
    if (stored?.intents?.length) {
      setSelectedIntents(stored.intents);
    }
    setMounted(true);
  }, []);

  const handleToggle = (value: WelcomeIntentOption) => {
    const next = selectedIntents.includes(value)
      ? selectedIntents.filter((x) => x !== value)
      : [...selectedIntents, value];
    setSelectedIntents(next);
    setWelcomeProfile({ intents: next });
  };

  const mascotEnabled =
    typeof serverMascotEnabled === "boolean"
      ? serverMascotEnabled
      : process.env.NEXT_PUBLIC_MASCOT_ENABLED === "true";
  const hasSelection = selectedIntents.length >= 1;
  const canContinue = hasSelection && !authLoading;

  const handleContinue = () => {
    if (authLoading || !hasSelection) return;
    router.push(userId ? "/" : "/signup");
  };

  if (!mounted) {
    return (
      <div className="max-w-2xl w-full mx-auto animate-fade-in opacity-0">
        <span className="sr-only" aria-live="polite">Loading…</span>
        <div className="h-24" aria-hidden="true" />
        <div className="h-64 rounded-xl bg-[var(--surface)]/40" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl w-full mx-auto flex flex-col">
      {mascotEnabled && (
        <section aria-label="JAX mascot greeting" className="flex-shrink-0">
          <JaxWelcomeHero selectedCount={selectedIntents.length} />
        </section>
      )}

      <div
        className={`animate-fade-in opacity-0 flex-shrink-0 ${mascotEnabled ? "mt-8" : ""}`}
        style={{ animationDelay: "0.2s" }}
      >
        <div className="flex justify-center mb-8">
          <Image
            src={brand.logoPath}
            alt={brand.logoAlt}
            width={140}
            height={94}
            className="object-contain"
            priority
          />
        </div>
        <h1 className="hero-title text-accent mb-3">
          Welcome to {brand.name}
        </h1>
        <p className="hero-subtitle mb-10">
          {brand.tagline}
        </p>
      </div>

      <div
        className="quiz-card animate-scale-in opacity-0 mb-8"
        style={{ animationDelay: "0.3s" }}
      >
        <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
          What brings you here?
        </h2>
        <p className="text-muted text-sm mb-6">
          Choose one or more—we&apos;ll tailor your experience
        </p>
        <div className="grid grid-cols-2 gap-3">
          {WELCOME_INTENT_OPTIONS.map((value, idx) => (
            <button
              key={value}
              type="button"
              onClick={() => handleToggle(value)}
              className={`welcome-intent-btn motion-heavy animate-fade-in opacity-0 rounded-xl border-2 px-4 py-3 text-left focus:outline-none ${
                selectedIntents.includes(value)
                  ? "border-[var(--brand-lime)] bg-[var(--brand-lime)]/15"
                  : "border-[var(--border)] bg-[var(--surface)]/60 hover:border-[var(--brand-lime)] hover:bg-[var(--surface)]"
              }`}
              style={{ animationDelay: `${0.35 + idx * 0.03}s` }}
            >
              <span className="font-semibold text-white block">{INTENT_LABELS[value]}</span>
              <span className="text-sm text-muted">{INTENT_DESCRIPTIONS[value]}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mt-6">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            className={`btn-primary motion-medium ${!canContinue ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Continue
          </button>
          {userId && (
            <Link href="/" className="btn-secondary motion-medium">
              Skip for now
            </Link>
          )}
        </div>
      </div>

      {!userId && !authLoading && (
        <p
          className="text-muted text-sm animate-fade-in opacity-0"
          style={{ animationDelay: "0.5s" }}
        >
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Sign in
          </Link>
          {" · "}
          <Link href="/start" className="text-accent hover:underline">
            Start here
          </Link> to choose your path first
        </p>
      )}
    </div>
  );
}
