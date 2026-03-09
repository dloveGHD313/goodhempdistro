"use client";

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

/**
 * Entry welcome page client shell.
 *
 * LCP fix: removed the `mounted` guard that was hiding the entire page until
 * JS hydration completed. The guard was added to prevent a hydration mismatch
 * when reading NEXT_PUBLIC_MASCOT_ENABLED, but that check was removed when
 * mascotEnabled was hardcoded to true. The guard was causing ~12s LCP on mobile.
 *
 * H1 is now rendered in a plain div (not Reveal) so it is visible in the
 * initial HTML paint — Reveal's opacity:0 initial state was making H1 invisible
 * until framer-motion hydrated.
 */
// Props kept for backwards compatibility with any callers passing mascotEnabled.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function WelcomeClient(_props: WelcomeClientProps = {}) {
  // Entry mascot always shown; AI widget gating is separate.
  const mascotEnabled = true;
  const heroSubtitle = entryHeroCopy.subtitle || brand.tagline;

  return (
    <div className="max-w-2xl w-full mx-auto flex flex-col items-center text-center">
      {/* JAX entry greeting — always shown on entry page */}
      {mascotEnabled && (
        <Reveal delay={HERO_DELAYS.title} className="flex-shrink-0 w-full flex justify-center">
          <section aria-label="JAX mascot greeting" className="flex justify-center">
            <JaxEntryGreeting />
          </section>
        </Reveal>
      )}

      {/* Logo + H1 — rendered in plain div so H1 is visible in initial HTML (LCP element) */}
      <div
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
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-12 px-4 max-w-4xl mx-auto text-center w-full">
        <div>
          <p className="text-lg font-semibold">🧪 Lab-Tested Products</p>
          <p className="text-muted text-sm mt-1">Every product backed by verified COA documentation</p>
        </div>
        <div>
          <p className="text-lg font-semibold">✅ Verified Vendors Only</p>
          <p className="text-muted text-sm mt-1">All sellers are reviewed before listing on the platform</p>
        </div>
        <div>
          <p className="text-lg font-semibold">🔒 21+ Compliant Platform</p>
          <p className="text-muted text-sm mt-1">Age-gated marketplace meeting state compliance requirements</p>
        </div>
      </div>

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
