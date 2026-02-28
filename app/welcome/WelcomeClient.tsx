"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { brand } from "@/lib/brand";
import JaxEntryGreeting from "@/components/entry/JaxEntryGreeting";
import { Reveal, HoverLift, HERO_DELAYS } from "@/components/motion";
import { entryHeroCopy } from "@/lib/entryCopy";

type WelcomeClientProps = {
  /** Preserved for compatibility with existing callers. */
  mascotEnabled?: boolean;
};

export default function WelcomeClient({ mascotEnabled: _serverMascotEnabled }: WelcomeClientProps = {}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Entry mascot should always be visible; AI widget remains flag-gated elsewhere.
  const mascotEnabled = true;
  const heroSubtitle = entryHeroCopy.subtitle || brand.tagline;

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
    <div className="max-w-2xl w-full mx-auto flex flex-col items-center text-center">
      {/* JAX entry greeting (shows CEO-specified line; hides itself when mascot is off) */}
      {mascotEnabled && (
        <Reveal delay={HERO_DELAYS.title} className="flex-shrink-0 w-full flex justify-center">
          <section aria-label="JAX mascot greeting" className="flex justify-center">
            <JaxEntryGreeting />
          </section>
        </Reveal>
      )}

      {/* Logo + headline */}
      <Reveal
        delay={HERO_DELAYS.title}
        className={`flex-shrink-0 w-full flex flex-col items-center ${mascotEnabled ? "mt-4" : ""}`}
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
          {entryHeroCopy.headlineLines.join(" ")}
        </h1>
      </Reveal>

      {/* Subtitle */}
      <Reveal delay={HERO_DELAYS.subtitle} className="w-full flex justify-center">
        <p className="hero-subtitle mb-10 max-w-xl">
          {heroSubtitle}
        </p>
      </Reveal>

      {/* Primary CTAs */}
      <Reveal delay={HERO_DELAYS.ctaRow} className="flex justify-center w-full">
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <HoverLift as="span" className="inline-block">
            <Link
              href={entryHeroCopy.primaryCTA.href}
              className="btn-primary motion-medium inline-block text-center min-w-[180px] py-3 px-8"
            >
              {entryHeroCopy.primaryCTA.label}
            </Link>
          </HoverLift>
          <HoverLift as="span" className="inline-block">
            <Link
              href={entryHeroCopy.secondaryCTA.href}
              className="btn-secondary motion-medium inline-block text-center min-w-[180px] py-3 px-8"
            >
              {entryHeroCopy.secondaryCTA.label}
            </Link>
          </HoverLift>
        </div>
      </Reveal>

      {/* Secondary link */}
      <Reveal delay={HERO_DELAYS.secondary} className="w-full flex justify-center">
        <p className="text-muted text-sm mt-6">
          Just browsing?{" "}
          <Link href="/get-started" className="text-accent hover:underline">
            Explore without an account
          </Link>
        </p>
      </Reveal>
    </div>
  );
}
