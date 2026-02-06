"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  getWelcomeFromStorage,
  setWelcomeInStorage,
  type WelcomeIntent,
} from "@/lib/phase0-storage";
import { brand } from "@/lib/brand";

const INTENTS: { value: WelcomeIntent; label: string; href: string; description: string }[] = [
  { value: "shop", label: "Shop", href: "/products", description: "Discover products" },
  { value: "sell", label: "Sell", href: "/vendor-registration", description: "Join as a vendor" },
  { value: "events", label: "Events", href: "/events", description: "Find events" },
  { value: "explore", label: "Explore", href: "/discover", description: "Browse the community" },
];

export default function WelcomeClient() {
  const [selectedIntent, setSelectedIntent] = useState<WelcomeIntent | null>(() => {
    const stored = getWelcomeFromStorage();
    return stored?.intent ?? null;
  });
  const [step, setStep] = useState<"quiz" | "done">(
    getWelcomeFromStorage()?.intent ? "done" : "quiz"
  );

  const handleSelect = (intent: WelcomeIntent) => {
    setSelectedIntent(intent);
    setWelcomeInStorage({ intent, completedAt: new Date().toISOString() });
    setStep("done");
  };

  return (
    <div className="max-w-2xl w-full mx-auto">
      <div
        className="animate-fade-in opacity-0"
        style={{ animationDelay: "0.1s" }}
      >
        <div className="flex justify-center mb-8">
          <Image
            src={brand.logoPath}
            alt={brand.logoAlt}
            width={180}
            height={120}
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

      {step === "quiz" && (
        <div
          className="quiz-card animate-scale-in opacity-0 mb-8"
          style={{ animationDelay: "0.25s" }}
        >
          <h2 className="text-xl font-bold text-white mb-2">
            What brings you here?
          </h2>
          <p className="text-muted text-sm mb-6">
            Choose one to get started
          </p>
          <div className="grid grid-cols-2 gap-3">
            {INTENTS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => handleSelect(item.value)}
                className="motion-heavy rounded-xl border-2 border-[var(--border)] bg-[var(--surface)]/60 px-4 py-4 text-left transition-all hover:border-[var(--brand-lime)] hover:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-lime)]"
              >
                <span className="font-semibold text-white block">{item.label}</span>
                <span className="text-sm text-muted">{item.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "done" && selectedIntent && (
        <div
          className="quiz-card animate-fade-in opacity-0 mb-8"
          style={{ animationDelay: "0.1s" }}
        >
          <p className="text-muted mb-4">You chose: <strong className="text-white">{INTENTS.find((i) => i.value === selectedIntent)?.label}</strong></p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={INTENTS.find((i) => i.value === selectedIntent)?.href ?? "/"}
              className="btn-primary motion-medium"
            >
              Continue
            </Link>
            <Link href="/login" className="btn-secondary motion-medium">
              Sign in
            </Link>
            <Link href="/signup" className="btn-ghost motion-medium">
              Create account
            </Link>
          </div>
        </div>
      )}

      <p
        className="text-muted text-sm animate-fade-in opacity-0"
        style={{ animationDelay: "0.4s" }}
      >
        <Link href="/" className="text-accent hover:underline">
          Skip to home
        </Link>
      </p>
    </div>
  );
}
